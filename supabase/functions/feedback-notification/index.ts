// supabase/functions/feedback-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Steadwell Feedback <hello@trysteadwell.app>";
const TO   = "hello@trysteadwell.app";

serve(async (req) => {
  try {
    const { email, type, subject, message, page } = await req.json();

    const typeColors: Record<string, string> = {
      Bug: "#C16140", Suggestion: "#234A3D", Question: "#B8861E", Other: "#5A534B",
    };
    const color = typeColors[type] || "#234A3D";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:22px 32px;display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;background:#C16140;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="18" height="18">
          <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:17px;font-weight:700;">Steadwell</span>
      <span style="margin-left:auto;background:${color};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;">${type || "Feedback"}</span>
    </div>
    <div style="padding:28px 32px;">
      <div style="font-size:18px;font-weight:700;color:#2A2723;margin-bottom:6px;">${subject || "New feedback"}</div>
      <div style="font-size:12px;color:#A8A09A;margin-bottom:20px;">
        From: <strong style="color:#5A534B;">${email}</strong> &nbsp;·&nbsp; Page: <strong style="color:#5A534B;">${page || "unknown"}</strong>
      </div>
      <div style="background:#F4EDDF;border-radius:12px;padding:18px 20px;font-size:15px;color:#2A2723;line-height:1.65;white-space:pre-wrap;">${message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
      <div style="margin-top:20px;padding:14px 18px;background:#FBF7EE;border:1px solid #E0D8C9;border-radius:10px;font-size:13px;color:#7A7370;">
        💡 Reply to this email to respond directly to ${email}
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:     FROM,
        to:       [TO],
        reply_to: [email],
        subject:  `[${type || "Feedback"}] ${subject || `New message from ${email}`}`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, ...data }), { status: res.ok ? 200 : 500 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
