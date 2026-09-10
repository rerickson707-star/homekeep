import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifies Resend's Svix-signed webhook manually (no npm 'resend' SDK dependency,
// since its webhook verification internals aren't guaranteed to work cleanly
// under Deno). Implements the documented Svix scheme directly:
// signed content = "<svix-id>.<svix-timestamp>.<raw-body>", HMAC-SHA256,
// key = base64-decoded secret with the "whsec_" prefix stripped.
async function verifySvixSignature(payload, svixId, svixTimestamp, svixSignature, secret) {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(svixTimestamp, 10);
  if (!ts || Math.abs(now - ts) > 300) return false; // reject if older than 5 minutes (replay protection)

  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const signedContent = svixId + "." + svixTimestamp + "." + payload;

  const key = await crypto.subtle.importKey(
    "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  // svix-signature header can carry multiple space-separated "v1,<sig>" values (secret rotation) --
  // valid if any one matches.
  const provided = svixSignature.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  return provided.includes(expected);
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text(); // raw text, not parsed JSON -- signature is sensitive to any reformatting
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing signature headers", { status: 400 });
    }

    const secret = Deno.env.get("RESEND_BOUNCE_WEBHOOK_SECRET");
    const valid = await verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.type === "email.bounced" || event.type === "email.complained") {
      const recipients = event.data?.to;
      const bouncedEmail = Array.isArray(recipients) ? recipients[0] : recipients;

      if (bouncedEmail) {
        const supabase = createClient(Deno.env.get("DB_URL"), Deno.env.get("SERVICE_ROLE_KEY"));

        // NOTE: listUsers() paginates (perPage below reduces how often this matters at
        // current scale, but this will need a real lookup -- e.g. a dedicated email
        // index table -- once the user base grows past a few thousand accounts).
        const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const match = usersPage?.users?.find(
          (u) => u.email?.toLowerCase() === bouncedEmail.toLowerCase()
        );

        if (match) {
          await supabase.auth.admin.updateUserById(match.id, {
            app_metadata: { email_bounced: true, email_verified: false },
          });
        }

        // Notify Robert regardless of whether a matching user was found --
        // worth knowing about bounce patterns (e.g. a spam wave) either way.
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + Deno.env.get("RESEND_API_KEY"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Steadwell <hello@trysteadwell.app>",
            to: ["hello@trysteadwell.app"],
            subject: (event.type === "email.bounced" ? "Bounce" : "Spam complaint") + ": " + bouncedEmail,
            html:
              "<p><strong>" + bouncedEmail + "</strong> triggered a " + event.type + " event.</p>" +
              "<p>Matching account " + (match ? "found and flagged (id " + match.id + ")." : "not found.") + "</p>",
          }),
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
