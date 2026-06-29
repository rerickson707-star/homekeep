// supabase/functions/drip-day5/index.ts
// Day 5: Projects & ROI Calculator — contractor vs DIY
// Deploy: npx supabase functions deploy drip-day5 --no-verify-jwt
// Scheduled via pg_cron daily at 10am UTC

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM           = "Steadwell <hello@trysteadwell.app>";
const APP_URL        = "https://www.trysteadwell.app";

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 5);
  const dateStr = targetDate.toISOString().slice(0, 10);

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const targets = users.filter(u => u.created_at?.slice(0, 10) === dateStr && u.email);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, name, email_digest")
    .in("user_id", targets.map(u => u.id))
    .neq("email_digest", false);

  const profileMap: Record<string, any> = {};
  for (const p of profiles || []) profileMap[p.user_id] = p;

  const results: string[] = [];

  for (const user of targets) {
    const profile = profileMap[user.id];
    if (!profile) continue;
    const name = profile.name?.split(" ")[0] || user.email.split("@")[0];

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #ECE3D2; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .wrap { max-width: 580px; margin: 40px auto; background: #FBF7EE; border-radius: 16px; overflow: hidden; }
    .header { background: #234A3D; padding: 28px 40px; display: flex; align-items: center; gap: 12px; }
    .header-logo { width: 36px; height: 36px; background: #234A3D; border: 1.5px solid rgba(244,237,223,.15); border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .header-name { color: #F4EDDF; font-size: 20px; font-weight: 700; font-family: Georgia, serif; }
    .body { padding: 40px; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #C16140; margin: 0 0 10px; }
    h1 { font-family: Georgia, serif; font-size: 24px; color: #234A3D; font-weight: 400; margin: 0 0 14px; line-height: 1.3; }
    p { font-size: 14px; color: #5A534B; line-height: 1.7; margin: 0 0 16px; }
    .roi-table { width: 100%; border-collapse: collapse; margin: 0 0 20px; }
    .roi-table th { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #A8A09A; padding: 0 0 10px; text-align: left; border-bottom: 1px solid #E6DECF; }
    .roi-table th:not(:first-child) { text-align: center; }
    .roi-table td { font-size: 13px; color: #2A2723; padding: 10px 0; border-bottom: 1px solid #E6DECF; vertical-align: middle; }
    .roi-table td:not(:first-child) { text-align: center; }
    .roi-table tr:last-child td { border-bottom: none; }
    .proj-name { font-weight: 600; color: #234A3D; }
    .proj-scope { font-size: 11px; color: #A8A09A; margin-top: 1px; }
    .roi-pct { font-family: Georgia, serif; font-size: 15px; font-weight: 600; color: #234A3D; }
    .cost-range { font-size: 11px; color: #5A534B; }
    .diy-range { font-size: 11px; color: #7A7370; }
    .diy-note { background: #F4EDDF; border-radius: 12px; padding: 18px 22px; margin: 0 0 20px; }
    .diy-note-title { font-size: 12px; font-weight: 700; color: #234A3D; margin: 0 0 8px; }
    .diy-note-body { font-size: 13px; color: #5A534B; line-height: 1.6; margin: 0; }
    .plus-note { font-size: 12px; color: #A8A09A; margin: 0 0 20px; line-height: 1.5; }
    .cta { text-align: center; margin: 4px 0 0; }
    .cta a { background: #C16140; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 40px; font-size: 14px; font-weight: 700; display: inline-block; }
    .footer { padding: 24px 40px; border-top: 1px solid #E0D8C9; text-align: center; margin-top: 32px; }
    .footer p { font-size: 12px; color: #A8A09A; margin: 0; }
    .footer a { color: #A8A09A; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
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
    <div class="body">
      <div class="eyebrow">Project ROI Calculator</div>
      <h1>Hi ${name} — know what a renovation returns before you spend a dollar</h1>
      <p>Most homeowners make renovation decisions based on gut feel. Steadwell shows you the estimated cost range, what each project typically adds to your home's resale value, and how contractor vs. DIY changes the math.</p>

      <table class="roi-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>ROI</th>
            <th>Contractor cost</th>
            <th>DIY cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><div class="proj-name">Kitchen remodel</div><div class="proj-scope">Mid-range update</div></td>
            <td><div class="roi-pct">76%</div></td>
            <td><div class="cost-range">$25k – $50k</div></td>
            <td><div class="diy-range">$12k – $25k</div></td>
          </tr>
          <tr>
            <td><div class="proj-name">Bathroom remodel</div><div class="proj-scope">Full renovation</div></td>
            <td><div class="roi-pct">66%</div></td>
            <td><div class="cost-range">$20k – $40k</div></td>
            <td><div class="diy-range">$9k – $18k</div></td>
          </tr>
          <tr>
            <td><div class="proj-name">Deck addition</div><div class="proj-scope">Standard deck</div></td>
            <td><div class="roi-pct">80%</div></td>
            <td><div class="cost-range">$12k – $25k</div></td>
            <td><div class="diy-range">$5k – $12k</div></td>
          </tr>
          <tr>
            <td><div class="proj-name">Garage door</div><div class="proj-scope">Standard replacement</div></td>
            <td><div class="roi-pct">194%</div></td>
            <td><div class="cost-range">$1.2k – $2.5k</div></td>
            <td><div class="diy-range">$700 – $1.5k</div></td>
          </tr>
          <tr>
            <td><div class="proj-name">Entry door</div><div class="proj-scope">Steel replacement</div></td>
            <td><div class="roi-pct">136%</div></td>
            <td><div class="cost-range">$800 – $1.8k</div></td>
            <td><div class="diy-range">$400 – $900</div></td>
          </tr>
        </tbody>
      </table>

      <div class="diy-note">
        <div class="diy-note-title">Contractor vs. DIY — how the math works</div>
        <div class="diy-note-body">The finished result adds the same value to your home regardless of who does the work. A renovated bathroom is worth the same to a buyer whether you tiled it yourself or paid someone. DIY means a lower spend — so the same value added produces a higher return on what you actually invested.</div>
      </div>

      <p class="plus-note">Cost ranges and ROI estimates are based on national Cost vs. Value Report averages. The full project ROI calculator — with scope selection, DIY toggle, and personalized estimates — is available on Plus and Pro plans.</p>

      <div class="cta">
        <a href="${APP_URL}">Try the ROI calculator →</a>
      </div>
    </div>
    <div class="footer">
      <p>Steadwell · <a href="${APP_URL}">trysteadwell.app</a> · <a href="${APP_URL}/unsubscribe?token=${user.id}">Unsubscribe</a></p>
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
        subject: `${name}, what does a kitchen remodel actually return?`,
        html,
      }),
    });

    const result = await res.json();
    results.push(`${user.email}: ${res.ok ? "sent " + result.id : "failed " + JSON.stringify(result)}`);
  }

  return new Response(JSON.stringify({ sent: results.length, results }), { status: 200 });
});
