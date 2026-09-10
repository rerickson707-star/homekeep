import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fires on auth.users INSERT (separate trigger from notify-new-signup, same event).
// Generates a verification token stored in app_metadata (NOT user_metadata --
// app_metadata can only be written by the service role, so a user can't fake
// their own "verified" status by editing their own profile).
//
// OAuth signups (Google, etc.) skip this entirely -- the provider already
// verified the email, so sending our own confirmation link would be redundant
// and confusing. Detected via raw_app_meta_data.provider on the auth.users row.
Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.id || !record.email) {
      return new Response(JSON.stringify({ error: "No id/email in payload" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("DB_URL"),
      Deno.env.get("SERVICE_ROLE_KEY")
    );

    const provider = record.raw_app_meta_data?.provider;
    if (provider && provider !== "email") {
      // OAuth provider already verified this address -- mark verified immediately, no email needed
      await supabase.auth.admin.updateUserById(record.id, {
        app_metadata: { email_verified: true },
      });
      return new Response(JSON.stringify({ skipped: "oauth-provider-verified" }), { status: 200 });
    }

    const token = crypto.randomUUID();

    const { error: updateError } = await supabase.auth.admin.updateUserById(record.id, {
      app_metadata: {
        email_verified: false,
        email_verify_token: token,
      },
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    const verifyUrl = "https://hjkyameroqufaojuerns.supabase.co/functions/v1/verify-email"
      + "?uid=" + encodeURIComponent(record.id)
      + "&token=" + encodeURIComponent(token);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("RESEND_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Steadwell <hello@trysteadwell.app>",
        to: [record.email],
        subject: "Confirm your email for Steadwell",
        html:
          "<p>Welcome to Steadwell.</p>" +
          "<p>Click the link below to confirm your email address, so you don't miss maintenance reminders, warranty alerts, and recall notices:</p>" +
          "<p><a href=\"" + verifyUrl + "\">Confirm my email</a></p>" +
          "<p>If you didn't sign up for Steadwell, you can ignore this email.</p>",
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
