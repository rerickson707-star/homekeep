// supabase/functions/warranty-expiry-reminders/index.ts
// Deploy: supabase functions deploy warranty-expiry-reminders --no-verify-jwt
// Schedule: run weekly via Supabase cron (pg_cron) or external cron
//
// Sends reminder emails via Resend for warranties expiring in 30 and 7 days.
// Uses service role key to read all user warranties across all properties.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL      = "reminders@trysteadwell.app";
const APP_URL         = "https://www.trysteadwell.app";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CATEGORY_ICONS: Record<string, string> = {
  HVAC:"🌡️", Appliance:"🍳", Electronics:"💻", Vehicle:"🚗", Tools:"🔧",
  Roofing:"🏚️", Plumbing:"🚿", Electrical:"⚡", Structure:"🧱",
  Safety:"🔒", Landscaping:"🌿", "Jewelry & Valuables":"💎", Outdoor:"🌳", Other:"🔧",
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr + "T00:00:00");
  return Math.round((exp.getTime() - now.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });
}

async function sendReminderEmail(
  toEmail: string,
  asset: {
    item: string; brand?: string; model?: string;
    category?: string; expiry_date: string;
    last_serviced?: string; serial_number?: string;
    replacement_cost?: number;
  },
  daysLeft: number,
  propertyAddress: string,
) {
  const icon  = CATEGORY_ICONS[asset.category || "Other"] || "🔧";
  const label = daysLeft <= 0 ? "expired" : daysLeft === 1 ? "expires tomorrow" : `expires in ${daysLeft} days`;
  const urgencyColor = daysLeft <= 7 ? "#B0432B" : daysLeft <= 30 ? "#B8861E" : "#234A3D";
  const bgColor      = daysLeft <= 7 ? "#F7E0DA" : daysLeft <= 30 ? "#FBF3DE" : "#E9F1EA";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EDDF;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:#173026;padding:28px 32px">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:rgba(244,237,223,.45);font-weight:700;margin-bottom:6px">Steadwell</div>
      <div style="font-family:Georgia,serif;font-size:22px;color:#F4EDDF;font-weight:400;line-height:1.3">Warranty reminder</div>
    </div>

    <!-- Alert banner -->
    <div style="background:${bgColor};border-bottom:1px solid rgba(0,0,0,.06);padding:16px 32px;display:flex;align-items:center;gap:12px">
      <span style="font-size:28px">${icon}</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:${urgencyColor}">${asset.item} ${label}</div>
        <div style="font-size:13px;color:#7A7370;margin-top:2px">${propertyAddress}</div>
      </div>
    </div>

    <!-- Details -->
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse">
        <tr style="border-bottom:1px solid #E8E0D0">
          <td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:40%">Item</td>
          <td style="padding:10px 0;font-size:14px;font-weight:700;color:#2A2723">${asset.item}</td>
        </tr>
        ${asset.brand ? `<tr style="border-bottom:1px solid #E8E0D0"><td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Brand</td><td style="padding:10px 0;font-size:14px;color:#2A2723">${asset.brand}${asset.model ? ` · ${asset.model}` : ""}</td></tr>` : ""}
        <tr style="border-bottom:1px solid #E8E0D0">
          <td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Warranty ends</td>
          <td style="padding:10px 0;font-size:14px;font-weight:700;color:${urgencyColor}">${formatDate(asset.expiry_date)}${daysLeft > 0 ? ` (${daysLeft} days)` : " (expired)"}</td>
        </tr>
        ${asset.serial_number ? `<tr style="border-bottom:1px solid #E8E0D0"><td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Serial #</td><td style="padding:10px 0;font-size:14px;color:#2A2723">${asset.serial_number}</td></tr>` : ""}
        ${asset.last_serviced ? `<tr style="border-bottom:1px solid #E8E0D0"><td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Last serviced</td><td style="padding:10px 0;font-size:14px;color:#2A2723">${formatDate(asset.last_serviced)}</td></tr>` : ""}
        ${asset.replacement_cost ? `<tr><td style="padding:10px 0;font-size:13px;color:#A8A09A;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Replace cost</td><td style="padding:10px 0;font-size:14px;color:#2A2723">$${Number(asset.replacement_cost).toLocaleString()}</td></tr>` : ""}
      </table>

      ${daysLeft > 0 ? `
      <div style="background:#FBF3DE;border:1px solid #EAD9A6;border-radius:10px;padding:16px;margin-top:20px">
        <div style="font-size:13px;font-weight:700;color:#B8861E;margin-bottom:6px">Before your warranty expires</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#5A534B;line-height:1.7">
          <li>Check if any issues need repair while still covered</li>
          <li>Document the item's current condition with a photo</li>
          <li>Consider an extended warranty if available</li>
          ${asset.last_serviced ? "" : "<li>Schedule a service visit — many manufacturers require proof of maintenance for warranty claims</li>"}
        </ul>
      </div>` : `
      <div style="background:#F7E0DA;border:1px solid #E3B2A6;border-radius:10px;padding:16px;margin-top:20px">
        <div style="font-size:13px;font-weight:700;color:#B0432B;margin-bottom:6px">Warranty has expired</div>
        <div style="font-size:13px;color:#5A534B;line-height:1.6">Consider adding extended coverage or budgeting for replacement. The estimated replacement cost is ${asset.replacement_cost ? "$" + Number(asset.replacement_cost).toLocaleString() : "unknown — update this in Steadwell"}.</div>
      </div>`}

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px">
        <a href="${APP_URL}" style="display:inline-block;background:#234A3D;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px">
          Open Steadwell →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#173026;padding:16px 32px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:rgba(244,237,223,.35)">Steadwell · trysteadwell.app</span>
      <a href="${APP_URL}/unsubscribe" style="font-size:12px;color:rgba(244,237,223,.35);text-decoration:none">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to:   [toEmail],
      subject: `${icon} ${asset.item} warranty ${label}`,
      html,
    }),
  });

  return res.ok;
}

serve(async (req) => {
  // Allow manual trigger via POST, or scheduled run
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all warranties expiring in exactly 30 or 7 days
    const targets = [30, 7];
    let sent = 0;
    let errors = 0;

    for (const daysAhead of targets) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetStr = targetDate.toISOString().slice(0, 10);

      // Fetch warranties expiring on this date
      const { data: warranties, error } = await supabase
        .from("warranties")
        .select("*, profiles!inner(address, user_id)")
        .eq("expiry_date", targetStr)
        .neq("category", "Insurance"); // skip insurance records

      if (error) { console.error("DB error:", error); continue; }
      if (!warranties?.length) continue;

      // Group by user_id to get email
      const userIds = [...new Set(warranties.map((w: any) => w.user_id))];

      for (const uid of userIds) {
        // Get user email from auth
        const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(uid);
        if (authErr || !user?.email) continue;

        const userWarranties = warranties.filter((w: any) => w.user_id === uid);

        for (const asset of userWarranties) {
          const propertyAddress = (asset as any).profiles?.address || "your home";
          const daysLeft = daysUntil(asset.expiry_date);

          const ok = await sendReminderEmail(user.email, asset, daysLeft, propertyAddress);
          if (ok) sent++; else errors++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, timestamp: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Warranty reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
