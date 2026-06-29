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
    .header { background: #234A3D; padding: 28px 40px; }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 36px; height: 36px; background: #234A3D; border: 1.5px solid rgba(244,237,223,.15); border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .header-name { color: #F4EDDF; font-size: 20px; font-weight: 700; font-family: Georgia, serif; letter-spacing: -0.3px; }
    .body { padding: 40px; }
    h1 { font-family: Georgia, serif; font-size: 26px; color: #234A3D; font-weight: 400; margin: 0 0 14px; letter-spacing: -0.4px; line-height: 1.2; }
    p { font-size: 15px; color: #5A534B; line-height: 1.7; margin: 0 0 18px; }
    .what-we-do { background: #F4EDDF; border-radius: 12px; padding: 22px 28px; margin: 0 0 24px; }
    .wwd-title { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #C16140; margin: 0 0 14px; }
    .wwd-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 9px; font-size: 14px; color: #2A2723; }
    .wwd-row:last-child { margin-bottom: 0; }
    .wwd-dot { width: 5px; height: 5px; background: #C16140; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .steps { border: 1px solid #E6DECF; border-radius: 12px; padding: 22px 28px; margin: 0 0 24px; }
    .steps-title { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #234A3D; margin: 0 0 16px; }
    .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
    .step:last-child { margin-bottom: 0; }
    .step-num { background: #234A3D; color: #F4EDDF; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
    .step-text { font-size: 14px; color: #2A2723; line-height: 1.55; }
    .step-text strong { color: #234A3D; }
    .recall-box { background: #234A3D; border-radius: 12px; padding: 18px 22px; margin: 0 0 24px; display: flex; align-items: flex-start; gap: 14px; }
    .recall-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
    .recall-text { font-size: 13px; color: rgba(244,237,223,.8); line-height: 1.6; }
    .recall-text strong { color: #F4EDDF; }
    .cta { text-align: center; margin: 8px 0 24px; }
    .cta a { background: #C16140; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 40px; font-size: 15px; font-weight: 700; display: inline-block; }
    .whats-next { font-size: 13px; color: #8A8178; line-height: 1.7; margin: 0 0 0; padding-top: 20px; border-top: 1px solid #E6DECF; }
    .roi-box { border: 1.5px solid #C16140; border-radius: 12px; padding: 18px 22px; margin: 0 0 24px; }
    .roi-box-title { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #C16140; margin: 0 0 10px; }
    .roi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 12px 0; }
    .roi-stat { text-align: center; }
    .roi-num { font-family: Georgia, serif; font-size: 20px; font-weight: 600; color: #234A3D; display: block; }
    .roi-lbl { font-size: 10px; color: #A8A09A; text-transform: uppercase; letter-spacing: .06em; }
    .roi-note { font-size: 11px; color: #8A8178; line-height: 1.5; margin: 10px 0 0; border-top: 1px solid #E6DECF; padding-top: 10px; }
    .footer { padding: 24px 40px; border-top: 1px solid #E0D8C9; text-align: center; margin-top: 24px; }
    .footer p { font-size: 12px; color: #A8A09A; margin: 0; line-height: 1.7; }
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
      <h1>Welcome, ${displayName} — your home is in good hands.</h1>
      <p>Most homeowners find out their warranty expired after something breaks. Or discover a recall months too late. Or lose track of which contractor did what, and for how much. Steadwell fixes all of that.</p>

      <div class="what-we-do">
        <div class="wwd-title">What Steadwell tracks for you</div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Warranties</strong> — every appliance and system, with 30-day and 7-day expiry alerts</span></div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Maintenance</strong> — recurring schedules, reminders, and a full service history</span></div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Contractors</strong> — save trusted pros and log every visit and invoice</span></div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Documents</strong> — deeds, permits, inspection reports, and insurance policies</span></div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Costs</strong> — every expense logged, with a 5-year forecast based on your system ages</span></div>
        <div class="wwd-row"><div class="wwd-dot"></div><span><strong>Projects & ROI</strong> — track renovations and see what each one adds to your resale value</span></div>
      </div>

      <div class="recall-box">
        <div class="recall-icon">🔔</div>
        <div class="recall-text"><strong>We're already watching for recalls.</strong> Every product you add to Steadwell is automatically checked against the CPSC safety recall database. Over 300 products are recalled every year — most homeowners never find out. You will.</div>
      </div>

      <div class="steps">
        <div class="steps-title">Get started in 3 minutes</div>
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Enter your address</strong> — we'll set up your home profile and you can add your system ages and appliances from there.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Add your first warranty or task</strong> — a recent appliance purchase or a maintenance item you've been putting off.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>Forward a receipt</strong> — send any home receipt to your unique Steadwell address and we create the warranty and expense record automatically. Find your address under Email Inbox on the My Home tab.</div>
        </div>
      </div>

      <div class="roi-box">
        <div class="roi-box-title">Project ROI Calculator — know before you renovate</div>
        <p style="font-size:13px;color:#5A534B;line-height:1.6;margin:0 0 10px;">Planning a kitchen remodel, deck, or bathroom update? Steadwell shows you the estimated cost range and how much each project adds to your home's resale value — before you spend a dollar.</p>
        <div class="roi-row">
          <div class="roi-stat"><span class="roi-num">76%</span><span class="roi-lbl">Kitchen ROI</span></div>
          <div class="roi-stat"><span class="roi-num">80%</span><span class="roi-lbl">Deck ROI</span></div>
          <div class="roi-stat"><span class="roi-num">66%</span><span class="roi-lbl">Bathroom ROI</span></div>
        </div>
        <div class="roi-note">Contractor vs. DIY cost estimates included. The finished result adds the same value either way — DIY just means a higher return on what you spend.</div>
      </div>

      <div class="cta">
        <a href="https://www.trysteadwell.app">Go to my home →</a>
      </div>

      <div class="whats-next">
        Over the next two weeks we'll send a few short tips to help you get the most out of Steadwell — things like AI scanning, recall alerts, project ROI, and the 5-year cost forecast. We keep it useful and easy to unsubscribe if it's not for you.
      </div>
    </div>
    <div class="footer">
      <p>You're receiving this because you signed up at <a href="https://www.trysteadwell.app">trysteadwell.app</a>.<br>
      Questions? Reply to this email — we read every one. · <a href="https://www.trysteadwell.app/unsubscribe">Unsubscribe</a></p>
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
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
