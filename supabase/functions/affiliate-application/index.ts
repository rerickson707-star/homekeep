// supabase/functions/affiliate-application/index.ts
// Receives affiliate application form and emails Robert
// Deploy: npx supabase functions deploy affiliate-application --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name, email, website, audience, why, contentType, reach, otherProfiles, payoutMethod } = await req.json();

    if (!name || !email || !website) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store in Supabase
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.from("affiliate_applications").insert({
      name, email, website,
      content_type: contentType || null,
      reach: reach || null,
      audience: audience || null,
      other_profiles: otherProfiles || null,
      why: why || null,
      payout_method: payoutMethod || null,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    // Email Robert
    const notifyHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light;}</style></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ECE3D2;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:24px 36px;display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;background:#234A3D;border:1.5px solid rgba(244,237,223,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:18px;font-weight:700;font-family:Georgia,serif;">New Affiliate Application</span>
    </div>
    <div style="padding:32px 36px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:12px 0;font-size:13px;font-weight:700;color:#9A9088;width:140px;text-transform:uppercase;letter-spacing:.06em;">Name</td>
          <td style="padding:12px 0;font-size:15px;color:#2A2723;font-weight:600;">${name}</td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:12px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Email</td>
          <td style="padding:12px 0;font-size:15px;color:#2A2723;"><a href="mailto:${email}" style="color:#234A3D;">${email}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;width:140px;text-transform:uppercase;letter-spacing:.06em;">Website</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;"><a href="${website}" style="color:#234A3D;">${website}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Content type</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${contentType || "Not specified"}</td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Monthly reach</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${reach || "Not specified"}</td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Audience</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${audience || "Not provided"}</td>
        </tr>
        ${otherProfiles ? `<tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Other profiles</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${otherProfiles}</td>
        </tr>` : ""}
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;vertical-align:top;">Promotion plan</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;line-height:1.6;">${why || "Not provided"}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Payout method</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${payoutMethod || "Not provided"}</td>
        </tr>
      </table>
      <div style="margin-top:28px;padding:16px 20px;background:rgba(35,74,61,.06);border-radius:10px;border-left:3px solid #234A3D;">
        <div style="font-size:13px;font-weight:700;color:#234A3D;margin-bottom:6px;">Next steps</div>
        <div style="font-size:13px;color:#5A534B;line-height:1.6;">Reply to this email to approve or decline. The applicant is expecting a response within 3 business days at <strong>${email}</strong>.</div>
      </div>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell Affiliate Program &middot; Submitted ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
    </div>
  </div>
</body>
</html>`;

    // Send to Robert
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Steadwell Affiliates <hello@trysteadwell.app>",
        to: ["hello@trysteadwell.app"],
        reply_to: email,
        subject: `New affiliate application — ${name}`,
        html: notifyHtml,
      }),
    });

    // Send confirmation to applicant
    const confirmHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light;}</style></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ECE3D2;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:24px 36px;display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;background:#234A3D;border:1.5px solid rgba(244,237,223,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:18px;font-weight:700;font-family:Georgia,serif;">Steadwell</span>
    </div>
    <div style="padding:32px 36px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#234A3D;font-weight:400;margin:0 0 12px;">Application received, ${name.split(" ")[0]}.</h1>
      <p style="font-size:15px;color:#5A534B;line-height:1.7;margin:0 0 20px;">Thanks for applying to the Steadwell Affiliate Program. We review every application personally and will get back to you at this address within 3 business days.</p>
      <div style="background:#F4EDDF;border-radius:12px;padding:18px 22px;margin:0 0 24px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9A9088;margin-bottom:12px;">What you applied for</div>
        <div style="font-size:14px;color:#2A2723;line-height:1.8;">
          &#10003; 30% recurring commissions on monthly subscriptions<br/>
          &#10003; 40% one-time commissions on annual subscriptions<br/>
          &#10003; 25% commissions on PDF guide sales<br/>
          &#10003; 30-day cookie window<br/>
          &#10003; Monthly payouts at $50 minimum
        </div>
      </div>
      <p style="font-size:14px;color:#8A8178;margin:0;">Questions in the meantime? Reply to this email or reach us at <a href="mailto:affiliates@trysteadwell.app" style="color:#234A3D;">affiliates@trysteadwell.app</a>.</p>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell, LLC &middot; <a href="https://www.trysteadwell.app/affiliates" style="color:#A8A09A;">trysteadwell.app/affiliates</a></p>
    </div>
  </div>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Steadwell Affiliates <hello@trysteadwell.app>",
        to: [email],
        subject: "Your Steadwell affiliate application was received",
        html: confirmHtml,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
