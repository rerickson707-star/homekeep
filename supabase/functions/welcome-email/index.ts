// supabase/functions/welcome-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";

serve(async (req) => {
  try {
    const { email, name } = await req.json();
    if (!email) return new Response("Missing email", { status: 400 });

    const displayName = name || email.split("@")[0];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #ECE3D2; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .wrap { max-width: 580px; margin: 40px auto; background: #FBF7EE; border-radius: 16px; overflow: hidden; }
    .header { background: #234A3D; padding: 32px 40px; }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 38px; height: 38px; background: #234A3D; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .header-name { color: #F4EDDF; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    h1 { font-size: 26px; color: #234A3D; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.4px; }
    p { font-size: 15px; color: #5A534B; line-height: 1.65; margin: 0 0 18px; }
    .steps { background: #F4EDDF; border-radius: 12px; padding: 24px 28px; margin: 24px 0; }
    .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
    .step:last-child { margin-bottom: 0; }
    .step-num { background: #234A3D; color: #F4EDDF; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .step-text { font-size: 14px; color: #2A2723; line-height: 1.5; }
    .step-text strong { color: #234A3D; }
    .cta { text-align: center; margin: 32px 0 8px; }
    .cta a { background: #C16140; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 40px; font-size: 15px; font-weight: 700; display: inline-block; }
    .footer { padding: 24px 40px; border-top: 1px solid #E0D8C9; text-align: center; }
    .footer p { font-size: 12px; color: #A8A09A; margin: 0; }
    .footer a { color: #A8A09A; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="header-brand">
        <div class="header-logo">
          <svg viewBox="0 0 48 48" fill="none" width="22" height="22">
            <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
          </svg>
        </div>
        <span class="header-name">Steadwell</span>
      </div>
    </div>
    <div class="body">
      <h1>Welcome, ${displayName} 🏠</h1>
      <p>You're in. Steadwell is your home's long-term memory — maintenance tasks, warranties, expenses, and documents, all in one place.</p>
      <p>Here's how to get the most out of it in the next 3 minutes:</p>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Enter your address</strong> — we'll pull 50+ fields from public records automatically. Year built, square footage, tax history, past sales.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Add your first task</strong> — a maintenance item you've been meaning to do. Set a due date and it'll show up on your calendar.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>Upload a document</strong> — a warranty card, insurance policy, or inspection report. It'll be searchable and tied to your home forever.</div>
        </div>
      </div>
      <div class="cta">
        <a href="https://www.trysteadwell.app">Go to my home →</a>
      </div>
    </div>
    <div class="footer">
      <p>You're receiving this because you signed up at <a href="https://www.trysteadwell.app">trysteadwell.app</a>.<br>
      Questions? Reply to this email — we read every one.</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Welcome to Steadwell — your home, kept well.",
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify(data), { status: 500 });
    return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
