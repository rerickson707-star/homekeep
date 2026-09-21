import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fires on auth.users INSERT (separate trigger from notify-new-signup, same event).
// Generates a verification token stored in app_metadata (NOT user_metadata --
// app_metadata can only be written by the service role, so a user can't fake
// their own "verified" status by editing their own profile).
//
// OAuth signups (Google, etc.) skip this entirely -- the provider already
// verified the email, so sending our own confirmation link would be redundant
// and confusing. Detected via raw_app_meta_data.provider on the auth.users row.
//
// Also called directly from the browser (App.jsx's "resend verification"
// button, via supabase.functions.invoke) -- that's a second caller besides
// the Database Webhook, and it's the one that actually needs CORS handling:
// a Postgres-originated webhook call is server-to-server and was never
// affected by this, but a browser's preflight OPTIONS request has nothing to
// answer it without the block below, which every other function in this
// codebase already has and this one was missing.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.id || !record.email) {
      return new Response(JSON.stringify({ error: "No id/email in payload" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("DB_URL"),
      Deno.env.get("SERVICE_ROLE_KEY")
    );

    const provider = record.raw_app_meta_data?.provider;
    if (provider && provider !== "email") {
      // OAuth provider already verified this address -- mark verified immediately, no email needed
      await supabase.auth.admin.updateUserById(record.id, {
        email_confirm: true, // Supabase's own native flag -- keeps OAuth account-linking working correctly
        app_metadata: { email_verified: true },
      });
      return new Response(JSON.stringify({ skipped: "oauth-provider-verified" }), { status: 200, headers: CORS });
    }

    const token = crypto.randomUUID();

    const { error: updateError } = await supabase.auth.admin.updateUserById(record.id, {
      email_confirm: true, // Supabase's own native flag, kept in sync with the product decision
                            // to grant immediate access -- without this, a later Google sign-in
                            // with the same email can't auto-link and creates a duplicate account
      app_metadata: {
        email_verified: false,
        email_verify_token: token,
      },
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
    }

    const verifyUrl = "https://hjkyameroqufaojuerns.supabase.co/functions/v1/verify-email"
      + "?uid=" + encodeURIComponent(record.id)
      + "&token=" + encodeURIComponent(token);

    // Same visual system as the other branded Steadwell emails (send-gift-email,
    // the Supabase "Confirm signup" template): table-based layout, dark-green
    // header with the hosted app icon + wordmark, cream card, terracotta CTA
    // pill. Kept as a template literal here rather than the +-concatenation
    // style above, purely because a multi-line HTML block reads better that way.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <style>:root{color-scheme:light;}</style>
</head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#234A3D;">
      <tr>
        <td style="padding:28px 36px;text-align:center;">
          <img src="https://www.trysteadwell.app/icon-192.png" width="36" height="36" alt="Steadwell" style="display:block;margin:0 auto 10px;border-radius:8px;">
          <span style="color:#F4EDDF;font-size:19px;font-family:Georgia,serif;">Steadwell</span>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="padding:36px 36px 8px;text-align:center;">
          <h1 style="font-family:Georgia,serif;font-size:22px;color:#2A2723;font-weight:400;margin:0 0 12px;">Confirm your email address</h1>
          <p style="font-size:14px;color:#7A7370;line-height:1.6;margin:0 0 28px;">Welcome to Steadwell. Confirm your email so you don't miss maintenance reminders, warranty alerts, and recall notices.</p>

          <a href="${verifyUrl}" style="display:inline-block;background:#C16140;color:#fff;text-decoration:none;padding:13px 32px;border-radius:40px;font-size:15px;font-weight:700;">Confirm my email</a>

          <p style="font-size:12px;color:#A8A09A;line-height:1.6;margin:24px 0 0;">Or copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color:#C16140;word-break:break-all;">${verifyUrl}</a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="padding:16px 36px 28px;border-top:1px solid #E0D8C9;text-align:center;">
          <p style="font-size:11px;color:#A8A09A;margin:16px 0 0;">
            Steadwell &middot; <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a>
          </p>
          <p style="font-size:11px;color:#A8A09A;margin:6px 0 0;">Didn't sign up for Steadwell? You can safely ignore this email.</p>
        </td>
      </tr>
    </table>

  </div>
</body>
</html>`;

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
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
