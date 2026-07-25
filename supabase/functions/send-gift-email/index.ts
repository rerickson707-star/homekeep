// supabase/functions/send-gift-email/index.ts
// Called from /agent-setup completion screen when agent enters a client's email
// Sends a branded gift email showing the agent's name and the gift link
// Deploy: npx supabase functions deploy send-gift-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";
const BASE_URL              = "https://www.trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { agent_token, client_name, client_email } = await req.json();

    if (!agent_token || !client_name || !client_email) {
      return new Response(JSON.stringify({ error: "agent_token, client_name, and client_email required" }), { status: 400, headers: CORS });
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Fetch the agent application by token
    const { data: agent, error: agentErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("token", agent_token)
      .eq("status", "approved")
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found or not approved" }), { status: 404, headers: CORS });
    }

    if (!agent.gift_code) {
      return new Response(JSON.stringify({ error: "Gift link not yet generated — please wait for approval confirmation" }), { status: 400, headers: CORS });
    }

    const agentName   = agent.display_name || agent.name;
    const giftUrl     = `${BASE_URL}/gift/${agent.gift_code}`;
    const firstName   = client_name.split(" ")[0] || client_name;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <style>:root{color-scheme:light;}</style>
</head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#234A3D;padding:28px 36px;text-align:center;">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;">
        <svg viewBox="0 0 48 48" fill="none" width="28" height="28">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34.5 L37 34.5" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="24" cy="18.3" r="1.8" fill="#C16140"/>
        </svg>
        <span style="color:#F4EDDF;font-size:20px;font-family:Georgia,serif;">Steadwell</span>
      </div>
      <div style="font-size:32px;margin-bottom:10px;">🎁</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#F4EDDF;font-weight:400;margin:0 0 8px;">A gift for your new home, ${firstName}.</h1>
      <p style="font-size:13px;color:rgba(244,237,223,.65);margin:0;line-height:1.6;">Congratulations on your new home. ${agentName} has gifted you 3 months of Steadwell Plus.</p>
    </div>

    <!-- Agent card -->
    <div style="padding:28px 36px 0;">
      <div style="background:#F4EDDF;border-radius:14px;padding:16px 18px;display:flex;align-items:center;gap:14px;margin-bottom:24px;">
        ${agent.headshot_url
          ? `<img src="${agent.headshot_url}" alt="${agentName}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #E6DECF;"/>`
          : agent.logo_url
            ? `<img src="${agent.logo_url}" alt="${agent.brokerage||''}" style="width:52px;height:52px;border-radius:50%;object-fit:contain;background:#fff;padding:6px;flex-shrink:0;border:2px solid #E6DECF;"/>`
            : `<div style="width:52px;height:52px;border-radius:50%;background:#234A3D;display:flex;align-items:center;justify-content:center;color:#F4EDDF;font-size:20px;font-weight:700;flex-shrink:0;">${agentName[0]}</div>`
        }
        <div>
          <div style="font-size:11px;color:#A8A09A;margin-bottom:3px;">Gifted by</div>
          <div style="font-size:15px;font-weight:700;color:#2A2723;">${agentName}</div>
          ${agent.title ? `<div style="font-size:12px;color:#7A7370;margin-top:2px;">${agent.title}</div>` : ""}
          ${agent.brokerage ? `<div style="font-size:12px;color:#7A7370;">${agent.brokerage}</div>` : ""}
          ${agent.phone ? `<div style="font-size:12px;color:#7A7370;margin-top:2px;">${agent.phone}</div>` : ""}
          ${agent.agent_email ? `<div style="font-size:12px;color:#7A7370;margin-top:2px;">${agent.agent_email}</div>` : ""}
        </div>
      </div>

      <!-- What's included -->
      <div style="margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A8A09A;margin-bottom:12px;">Your gift includes</div>
        ${["Warranty tracking & expiry alerts", "Monthly maintenance schedules", "Cost tracking & ROI calculator", "AI receipt & nameplate scanning", "Document vault"].map(f =>
          `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #EFE7D6;font-size:13px;color:#2A2723;">
            <span style="color:#2E7050;font-weight:700;flex-shrink:0;">✓</span>${f}
           </div>`
        ).join("")}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${giftUrl}" style="display:inline-block;background:#C16140;color:#fff;text-decoration:none;padding:14px 32px;border-radius:40px;font-size:16px;font-weight:700;margin-bottom:12px;">Claim your gift →</a>
        <div style="font-size:12px;color:#A8A09A;line-height:1.5;">Or visit: <a href="${giftUrl}" style="color:#C16140;">${giftUrl}</a></div>
        <div style="font-size:12px;color:#A8A09A;margin-top:4px;">Free for 3 months · No credit card required</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">
        Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a>
        · This gift was sent on behalf of ${agentName}.
      </p>
    </div>
  </div>
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
        to: [client_email],
        subject: `${agentName} sent you a gift for your new home 🎁`,
        html,
        reply_to: agent.email || undefined,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Email failed", detail: result }), { status: 500, headers: CORS });
    }

    // Record the send for portal history tracking
    await supabase.from("gift_sends").insert([{
      agent_token:  agent.token,
      client_name:  client_name,
      client_email: client_email,
    }]).catch(err => console.error("[gift_sends] insert error:", err));

    return new Response(JSON.stringify({ ok: true, email_id: result.id }), { headers: CORS });

  } catch (err) {
    console.error("send-gift-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
