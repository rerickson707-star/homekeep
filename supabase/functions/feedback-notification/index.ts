import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Steadwell Feedback <hello@trysteadwell.app>";
const TO   = "hello@trysteadwell.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { email, type, subject, message, page } = await req.json();
    const typeColors = { Bug:"#C16140", Suggestion:"#234A3D", Question:"#B8861E", Other:"#5A534B" };
    const color = typeColors[type] || "#234A3D";
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#FBF7EE;border-radius:12px;overflow:hidden"><div style="background:#234A3D;padding:20px 28px"><span style="color:#F4EDDF;font-size:17px;font-weight:700">Steadwell</span><span style="margin-left:12px;background:${color};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${type||"Feedback"}</span></div><div style="padding:24px 28px"><div style="font-size:18px;font-weight:700;color:#2A2723;margin-bottom:6px">${subject||"New feedback"}</div><div style="font-size:12px;color:#A8A09A;margin-bottom:16px">From: <strong>${email}</strong> · Page: <strong>${page||"unknown"}</strong></div><div style="background:#F4EDDF;border-radius:10px;padding:16px;font-size:15px;color:#2A2723;line-height:1.6;white-space:pre-wrap">${message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div><div style="margin-top:16px;padding:12px 16px;border:1px solid #E0D8C9;border-radius:8px;font-size:13px;color:#7A7370">Reply to this email to respond directly to ${email}</div></div></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: [email], subject: `[${type||"Feedback"}] ${subject||`New message from ${email}`}`, html }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, ...data }), { status: res.ok ? 200 : 500, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
