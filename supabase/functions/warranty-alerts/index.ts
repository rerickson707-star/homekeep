// supabase/functions/warranty-alerts/index.ts
// Deploy: supabase functions deploy warranty-alerts --no-verify-jwt
// Secrets needed: RESEND_API_KEY, DB_URL, SERVICE_ROLE_KEY
// Schedule via pg_cron: '0 9 * * 1' (9am every Monday)
//
// Sends warranty expiry reminders at 30 days and 7 days out.
// Includes new categories: Electronics, Vehicle, Tools, Jewelry & Valuables, Outdoor.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY          = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL            = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM                    = "Steadwell <hello@trysteadwell.app>";
const APP_URL                 = "https://www.trysteadwell.app";

// Category icons — updated to include new categories
const CAT_ICONS: Record<string, string> = {
  HVAC:                   "🌡️",
  Appliance:              "🍳",
  Electronics:            "💻",
  Vehicle:                "🚗",
  Tools:                  "🔧",
  Roofing:                "🏚️",
  Plumbing:               "🚿",
  Electrical:             "⚡",
  Structure:              "🧱",
  Safety:                 "🔒",
  Landscaping:            "🌿",
  "Jewelry & Valuables":  "💎",
  Outdoor:                "🌳",
  Other:                  "🔧",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function dateForOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function buildEmail(
  name: string,
  warranties: any[],
  daysLeft: number,
): { subject: string; html: string } {
  const urgentColor = daysLeft <= 7 ? "#B0432B" : "#B8861E";
  const urgentBg    = daysLeft <= 7 ? "#F7E0DA" : "#FBF3DE";
  const urgentBorder= daysLeft <= 7 ? "#E3B2A6" : "#EAD9A6";
  const daysLabel   = daysLeft === 7 ? "7 days" : "30 days";
  const emoji       = daysLeft <= 7 ? "🚨" : "⚠️";

  const subject = warranties.length === 1
    ? `${emoji} Your ${warranties[0].item} warranty expires in ${daysLabel}`
    : `${emoji} ${warranties.length} warranties expiring in ${daysLabel}`;

  const itemCards = warranties.map(w => {
    const icon = CAT_ICONS[w.category] || "🔧";
    const expiryFormatted = formatDate(w.expiry_date);
    return `
      <div style="background:${urgentBg};border:1px solid ${urgentBorder};border-radius:12px;padding:16px 18px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:22px">${icon}</span>
          <div>
            <div style="font-size:15px;font-weight:700;color:#2A2723;">${w.item}</div>
            <div style="font-size:12px;color:#A8A09A;">${w.category || "Asset"}${w.brand ? " · " + w.brand : ""}${w.model ? " " + w.model : ""}</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
          <div style="font-size:12px;color:${urgentColor};font-weight:700;">Expires ${expiryFormatted}</div>
          ${w.serial_number ? `<div style="font-size:12px;color:#8A8178;">S/N ${w.serial_number}</div>` : ""}
          ${w.cost ? `<div style="font-size:12px;color:#8A8178;">Value: $${Number(w.cost).toLocaleString()}</div>` : ""}
          ${w.replacement_cost ? `<div style="font-size:12px;color:#8A8178;">Replace: $${Number(w.replacement_cost).toLocaleString()}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  const whatToDo = daysLeft <= 7
    ? `<ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#5A534B;line-height:1.9;">
        <li>File any outstanding warranty claims <strong>today</strong></li>
        <li>Document current condition with a photo</li>
        <li>Call the manufacturer — many will extend coverage if you ask</li>
        <li>Check if your homeowners or renters insurance covers it</li>
      </ul>`
    : `<ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#5A534B;line-height:1.9;">
        <li>Check for any issues that should be repaired while still covered</li>
        <li>Ask the manufacturer or retailer about extending coverage</li>
        <li>Document the item's current condition with a photo in Steadwell</li>
        <li>Review replacement cost so you're budgeted if needed</li>
      </ul>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#173026;padding:26px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:34px;height:34px;background:#C16140;border-radius:9px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="19" height="19">
          <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:19px;font-weight:700;letter-spacing:-.3px;">Steadwell</span>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${urgentColor};margin-bottom:10px;">${emoji} Warranty ${daysLeft <= 7 ? "expiring this week" : "expiring in 30 days"}</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#234A3D;font-weight:400;margin:0 0 6px;line-height:1.3;">
        Hi ${name} &mdash; ${warranties.length === 1 ? "a warranty expires" : `${warranties.length} warranties expire`} in ${daysLabel}
      </h1>
      <p style="font-size:14px;color:#8A8178;margin:0 0 24px;line-height:1.5;">
        ${daysLeft <= 7 ? "This is your final reminder. Act before coverage ends." : "You have 30 days to renew, extend, or plan a replacement."}
      </p>

      ${itemCards}

      <!-- What to do -->
      <div style="background:#F4EDDF;border-radius:12px;padding:16px 18px;margin:20px 0;">
        <div style="font-size:13px;font-weight:700;color:#234A3D;margin-bottom:8px;">What to do now</div>
        ${whatToDo}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${APP_URL}" style="background:#C16140;color:#fff;text-decoration:none;padding:13px 32px;border-radius:40px;font-size:14px;font-weight:700;display:inline-block;letter-spacing:-.1px;">
          View in Steadwell &#8594;
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">
        Steadwell &middot; <a href="${APP_URL}" style="color:#A8A09A;text-decoration:none;">trysteadwell.app</a>
        &middot; <a href="${APP_URL}/unsubscribe" style="color:#A8A09A;text-decoration:none;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check both 30-day and 7-day windows
  const windows = [30, 7];
  const allResults: string[] = [];
  let totalSent = 0;

  for (const daysAhead of windows) {
    const targetDate = dateForOffset(daysAhead);

    const { data: warranties, error } = await supabase
      .from("warranties")
      .select("id, item, category, expiry_date, brand, model, serial_number, cost, replacement_cost, user_id, property_id")
      .eq("expiry_date", targetDate)
      .neq("category", "Insurance"); // skip insurance policy records

    if (error) {
      allResults.push(`[${daysAhead}d] DB error: ${error.message}`);
      continue;
    }
    if (!warranties?.length) {
      allResults.push(`[${daysAhead}d] No warranties expiring`);
      continue;
    }

    // Group by user
    const byUser: Record<string, typeof warranties> = {};
    for (const w of warranties) {
      if (!byUser[w.user_id]) byUser[w.user_id] = [];
      byUser[w.user_id].push(w);
    }

    // Get all user emails in one call
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const emailMap: Record<string, string> = {};
    for (const u of users) { if (u.email) emailMap[u.id] = u.email; }

    // Get first names from profiles
    const { data: profiles } = await supabase.from("profiles").select("user_id, name");
    const nameMap: Record<string, string> = {};
    for (const p of profiles || []) {
      if (p.name) nameMap[p.user_id] = p.name.split(" ")[0];
    }

    for (const [userId, userWarranties] of Object.entries(byUser)) {
      const email = emailMap[userId];
      if (!email) continue;
      const name = nameMap[userId] || email.split("@")[0];

      const { subject, html } = buildEmail(name, userWarranties, daysAhead);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to: [email], subject, html }),
      });

      const result = await res.json();
      const status = res.ok ? `sent ${result.id}` : `failed ${JSON.stringify(result)}`;
      allResults.push(`[${daysAhead}d] ${email}: ${status}`);
      if (res.ok) totalSent++;
    }
  }

  return new Response(
    JSON.stringify({ sent: totalSent, results: allResults, timestamp: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});
