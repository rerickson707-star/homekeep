// supabase/functions/agent-welcome/index.ts
// Fires when an agent application is approved from the /admin page
// Deploy: npx supabase functions deploy agent-welcome --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY          = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Fetch the agent application
    const { data: agent, error: fetchErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (fetchErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: CORS });
    }

    const uploadLink = `${BASE_URL}/agent-setup?token=${agent.token}`;
    const firstName  = agent.name?.split(" ")[0] || "there";

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
  <div style="max-width:580px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#234A3D;padding:28px 40px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#1C3D31;border:1.5px solid rgba(244,237,223,.15);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg viewBox="0 0 48 48" fill="none" width="22" height="22">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:20px;font-weight:700;font-family:Georgia,serif;">Steadwell</span>
      <span style="color:rgba(244,237,223,.4);font-size:13px;margin-left:auto;">Agent Partner Program</span>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#234A3D;font-weight:400;margin:0 0 8px;">
        You're in, ${firstName}. Welcome to the program. 🎉
      </h1>
      <p style="font-size:14px;color:#A8A09A;margin:0 0 28px;">Here's everything you need to get started.</p>

      <!-- How it works -->
      <div style="background:#F4EDDF;border-radius:12px;padding:22px 24px;margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C16140;margin-bottom:14px;">How it works</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#234A3D;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#F4EDDF;">1</div>
            <div style="font-size:13px;color:#2A2723;line-height:1.5;"><strong>Upload your brand assets below</strong> — headshot, logo, and a few details. Takes about 2 minutes.</div>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#234A3D;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#F4EDDF;">2</div>
            <div style="font-size:13px;color:#2A2723;line-height:1.5;">We set up your co-branded gift link and send it to you — usually within one business day.</div>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div style="width:24px;height:24px;background:#234A3D;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#F4EDDF;">3</div>
            <div style="font-size:13px;color:#2A2723;line-height:1.5;">Share your gift link with closing clients. They get <strong>3 months of Steadwell Plus</strong>, with your name on it.</div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-family:Georgia,serif;font-size:17px;color:#2A2723;margin-bottom:8px;">First step: upload your brand assets</div>
        <div style="font-size:13px;color:#A8A09A;margin-bottom:20px;line-height:1.5;">Headshot, brokerage logo, and a few details — so your clients see your name and face when they redeem their gift.</div>
        <a href="${uploadLink}" style="background:#C16140;color:#fff;text-decoration:none;padding:14px 28px;border-radius:40px;font-size:15px;font-weight:700;display:inline-block;">Set up my agent profile &#8594;</a>
        <div style="margin-top:12px;font-size:12px;color:#A8A09A;">This link is unique to you — no login required.</div>
      </div>

      <!-- What clients see -->
      <div style="border-top:1px solid #E0D8C9;padding-top:22px;margin-bottom:22px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C16140;margin-bottom:12px;">What your clients see</div>
        <div style="background:#234A3D;border-radius:10px;padding:16px 18px;font-size:13px;color:rgba(244,237,223,.8);line-height:1.6;">
          "3 months of Steadwell Plus — gifted by <strong style="color:#F4EDDF;">${agent.name}</strong>${agent.brokerage ? `, ${agent.brokerage}` : ""}. Set up your home in minutes."
        </div>
      </div>

      <p style="font-size:13px;color:#7A7370;line-height:1.6;margin:0;">Questions? Reply to this email or reach me at <a href="mailto:hello@trysteadwell.app" style="color:#C16140;text-decoration:none;">hello@trysteadwell.app</a> — I'll get back to you same day.</p>
      <p style="font-size:13px;color:#7A7370;margin-top:8px;">— Robert, Steadwell</p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">
        Steadwell &middot; <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a>
        &middot; Agent Partner Program
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send the email
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
