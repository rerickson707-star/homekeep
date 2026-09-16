// supabase/functions/agent-welcome/index.ts
// Fires when an agent application is approved from the /admin page
// Deploy: npx supabase functions deploy agent-welcome --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY          = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL            = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM                    = "Steadwell <hello@trysteadwell.app>";
const BASE_URL                = "https://www.trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { agent_id } = await req.json();
    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id required" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: agent, error: fetchErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (fetchErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: CORS });
    }

    const portalLink = `${BASE_URL}/agent?email=${encodeURIComponent(agent.email)}`;
    const firstName  = agent.name?.split(" ")[0] || "there";
    const iconUrl    = `${BASE_URL}/icon-192.png`; // hosted PNG -- inline SVG doesn't render in most email clients

    // Table-based layout throughout -- matches the pattern already proven
    // reliable in send-gift-email. No flexbox: many email clients (Outlook
    // especially) don't support it, which is exactly what broke the
    // numbered steps and the header icon in the previous version.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light;supported-color-schemes:light;}</style>
</head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ECE3D2;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#FBF7EE;border-radius:16px;overflow:hidden;margin:40px auto;">

        <!-- Header -->
        <tr><td style="background:#234A3D;padding:24px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="36" valign="middle">
              <img src="${iconUrl}" width="36" height="36" alt="Steadwell" style="display:block;border-radius:9px;">
            </td>
            <td valign="middle" style="padding-left:12px;">
              <span style="color:#F4EDDF;font-size:20px;font-weight:700;font-family:Georgia,serif;">Steadwell</span>
            </td>
            <td align="right" valign="middle">
              <span style="color:rgba(244,237,223,.4);font-size:13px;">Agent Partner Program</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h1 style="font-family:Georgia,serif;font-size:24px;color:#234A3D;font-weight:400;margin:0 0 8px;">
            You're in, ${firstName}. Welcome to the program. 🎉
          </h1>
          <p style="font-size:14px;color:#A8A09A;margin:0 0 28px;">Here's everything you need to get started.</p>

          <!-- How it works -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EDDF;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C16140;margin-bottom:14px;">How it works</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="24" valign="top" style="padding-bottom:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="24" height="24" align="center" valign="middle" style="background:#234A3D;border-radius:50%;font-size:11px;font-weight:700;color:#F4EDDF;">1</td></tr></table>
                </td>
                <td style="padding:0 0 12px 14px;font-size:13px;color:#2A2723;line-height:1.5;"><strong>Sign in to your agent portal below</strong> — enter your email, click the link we send you, and add your headshot, logo, and a few details. Takes about 2 minutes.</td>
              </tr></table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="24" valign="top" style="padding-bottom:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="24" height="24" align="center" valign="middle" style="background:#234A3D;border-radius:50%;font-size:11px;font-weight:700;color:#F4EDDF;">2</td></tr></table>
                </td>
                <td style="padding:0 0 12px 14px;font-size:13px;color:#2A2723;line-height:1.5;">Your co-branded gift link is ready as soon as your profile is saved.</td>
              </tr></table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="24" valign="top">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="24" height="24" align="center" valign="middle" style="background:#234A3D;border-radius:50%;font-size:11px;font-weight:700;color:#F4EDDF;">3</td></tr></table>
                </td>
                <td style="padding:0 0 0 14px;font-size:13px;color:#2A2723;line-height:1.5;">Share your gift link with closing clients. They get <strong>3 months of Steadwell Plus</strong>, with your name on it.</td>
              </tr></table>

            </td></tr>
          </table>

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:28px;">
            <div style="font-family:Georgia,serif;font-size:17px;color:#2A2723;margin-bottom:8px;">First step: sign in to your agent portal</div>
            <div style="font-size:13px;color:#A8A09A;margin-bottom:20px;line-height:1.5;">Click below, confirm your email, and we'll send you a secure sign-in link — no password to set or remember.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C16140;border-radius:40px;">
              <a href="${portalLink}" style="display:inline-block;padding:14px 28px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;">Go to my agent portal &#8594;</a>
            </td></tr></table>
            <div style="margin-top:12px;font-size:12px;color:#A8A09A;">Bookmark trysteadwell.app/agent — sign in with this same email anytime to send gifts or update your profile.</div>
          </td></tr></table>

          <!-- What clients see -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E0D8C9;">
            <tr><td style="padding-top:22px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C16140;margin-bottom:12px;">What your clients see</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#234A3D;border-radius:10px;">
                <tr><td style="padding:16px 18px;font-size:13px;color:rgba(244,237,223,.8);line-height:1.6;">
                  "3 months of Steadwell Plus — gifted by <strong style="color:#F4EDDF;">${agent.name}</strong>${agent.brokerage ? `, ${agent.brokerage}` : ""}. Set up your home in minutes."
                </td></tr>
              </table>
            </td></tr>
          </table>

          <p style="font-size:13px;color:#7A7370;line-height:1.6;margin:22px 0 0;">Questions? Reply to this email or reach me at <a href="mailto:hello@trysteadwell.app" style="color:#C16140;text-decoration:none;">hello@trysteadwell.app</a> — I'll get back to you same day.</p>
          <p style="font-size:13px;color:#7A7370;margin-top:8px;">— Robert, Steadwell</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #E0D8C9;text-align:center;">
          <p style="font-size:11px;color:#A8A09A;margin:0;">
            Steadwell &middot; <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a>
            &middot; Agent Partner Program
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [agent.email],
        subject: `You're approved — welcome to the Steadwell agent program 🎉`,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Email failed", detail: result }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true, email_id: result.id }), { headers: CORS });

  } catch (err) {
    console.error("agent-welcome error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
