// supabase/functions/drip-day3/index.ts
// Day 3: Email capture feature
// Deploy: npx supabase functions deploy drip-day3 --no-verify-jwt
// Scheduled via pg_cron to run daily at 10am UTC

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM           = "Robert at Steadwell <hello@trysteadwell.app>";
const APP_URL        = "https://www.trysteadwell.app";

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find users who created their account exactly 3 days ago (UTC date match)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 3);
  const dateStr = targetDate.toISOString().slice(0, 10);

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const targets = users.filter(u =>
    u.created_at?.slice(0, 10) === dateStr &&
    u.email
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, name, inbound_email, email_digest")
    .in("user_id", targets.map(u => u.id))
    .neq("email_digest", false);

  const profileMap: Record<string, any> = {};
  for (const p of profiles || []) profileMap[p.user_id] = p;

  const results: string[] = [];

  for (const user of targets) {
    const profile = profileMap[user.id];
    if (!profile) continue;

    const name = profile.name?.split(" ")[0] || user.email.split("@")[0];
    const captureAddress = profile.inbound_email || `your-address@in.trysteadwell.app`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:28px 40px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#234A3D;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg viewBox="0 0 48 48" fill="none" width="22" height="22">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:19px;font-weight:700;font-family:Georgia,serif;">Steadwell</span>
    </div>
    <div style="padding:40px;">
      <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#C16140;margin:0 0 12px;">Quick tip</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#234A3D;font-weight:400;margin:0 0 16px;line-height:1.3;">
        Hi ${name} — forward a receipt and watch what happens
      </h1>
      <p style="font-size:15px;color:#5A534B;line-height:1.7;margin:0 0 20px;">
        Every Steadwell account has a unique email address. Forward any receipt, invoice, or warranty document to it and we automatically extract the details — no typing required.
      </p>
      <div style="background:#F4EDDF;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
        <p style="font-size:12px;font-weight:700;color:#234A3D;margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em;">Your capture address</p>
        <p style="font-family:monospace;font-size:14px;color:#2A2723;margin:0;word-break:break-all;">${captureAddress}</p>
      </div>
      <p style="font-size:15px;color:#5A534B;line-height:1.7;margin:0 0 8px;">Try it now — forward any home-related email and it will appear in your <strong>Email Inbox</strong> in the app within seconds.</p>
      <p style="font-size:14px;color:#8A8178;margin:0 0 28px;">Works with receipts, contractor invoices, warranty cards, inspection reports, and more.</p>
      <div style="text-align:center;">
        <a href="${APP_URL}" style="background:#C16140;color:#fff;text-decoration:none;padding:14px 32px;border-radius:40px;font-size:14px;font-weight:700;display:inline-block;">Open Email Inbox →</a>
      </div>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">
        Steadwell · <a href="${APP_URL}" style="color:#A8A09A;">trysteadwell.app</a> · <a href="${APP_URL}/unsubscribe?token=${user.id}" style="color:#A8A09A;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [user.email!],
        subject: `${name}, your Steadwell capture address is ready`,
        html,
      }),
    });

    const result = await res.json();
    results.push(`${user.email}: ${res.ok ? "sent " + result.id : "failed " + JSON.stringify(result)}`);
  }

  return new Response(JSON.stringify({ sent: results.length, results }), { status: 200 });
});
