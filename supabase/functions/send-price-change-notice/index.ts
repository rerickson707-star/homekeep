// supabase/functions/send-price-change-notice/index.ts
//
// Sends the price-increase notice the Terms of Service (Section 5) promise:
// "If we increase the price of your plan, we will notify you by email at
// least 30 days before the change takes effect."
//
// This is NOT a cron job -- a price change is something you decide to do,
// not a recurring event, so it's triggered on demand (e.g. from an /admin
// button you add, or by calling it directly once) rather than scheduled.
// It enforces the 30-day minimum itself so it can't be used in a way that
// would violate the promise in the Terms it exists to fulfill.
//
// Deploy: npx supabase functions deploy send-price-change-notice --no-verify-jwt
// (verifies the admin JWT itself below, same as admin-agent -- adjust the
// verification block if admin-agent's actual check differs from this.)
//
// Call it once, e.g. via curl or Postman, when you actually raise a price:
//   POST /functions/v1/send-price-change-notice
//   Authorization: Bearer <your admin session JWT, from being signed in as hello@trysteadwell.app>
//   {
//     "plan": "plus",                 // "plus" | "pro" | "both"
//     "newMonthlyPrice": "$8.99/month",
//     "newAnnualPrice": "$71.99/year",
//     "effectiveDate": "2026-12-01",  // ISO date, must be >= 30 days out
//     "note": "optional extra sentence appended to the email"
//   }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";
const BASE_URL              = "https://www.trysteadwell.app";
const ADMIN_EMAIL           = "hello@trysteadwell.app";

const MAILING_ADDRESS = Deno.env.get("COMPANY_MAILING_ADDRESS")
  || "Steadwell, LLC — mailing address pending, see hello@trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  try {
    // ── Admin auth check ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: CORS });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
    }

    // ── Validate request body ────────────────────────────────────────────
    const { plan, newMonthlyPrice, newAnnualPrice, effectiveDate, note } = await req.json();

    if (!["plus", "pro", "both"].includes(plan)) {
      return new Response(JSON.stringify({ error: "plan must be 'plus', 'pro', or 'both'" }), { status: 400, headers: CORS });
    }
    if (!newMonthlyPrice && !newAnnualPrice) {
      return new Response(JSON.stringify({ error: "newMonthlyPrice and/or newAnnualPrice required" }), { status: 400, headers: CORS });
    }
    const effective = new Date(effectiveDate);
    if (isNaN(effective.getTime())) {
      return new Response(JSON.stringify({ error: "effectiveDate must be a valid date" }), { status: 400, headers: CORS });
    }

    // Enforce the Terms' own promise: at least 30 days' notice.
    const minEffective = new Date(Date.now() + 30 * DAY_MS);
    if (effective.getTime() < minEffective.getTime()) {
      return new Response(JSON.stringify({
        error: `effectiveDate must be at least 30 days from now (earliest allowed: ${minEffective.toISOString().slice(0, 10)}). This function refuses to send a notice that would itself violate the Terms' 30-day promise.`,
      }), { status: 400, headers: CORS });
    }

    // ── Find affected active subscribers ────────────────────────────────
    const plansToNotify = plan === "both" ? ["plus", "pro"] : [plan];
    const { data: subscribers, error: subErr } = await supabase
      .from("profiles")
      .select("user_id, email, name, plan, plan_interval")
      .in("plan", plansToNotify)
      .not("stripe_subscription_id", "is", null);

    if (subErr) throw subErr;

    const effectiveLabel = effective.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let sent = 0, failed = 0;

    for (const p of subscribers ?? []) {
      if (!p.email) { console.error(`[send-price-change-notice] No email on profile ${p.user_id}, skipping`); continue; }

      const relevantPrice = p.plan_interval === "annual" ? newAnnualPrice : newMonthlyPrice;
      if (!relevantPrice) continue; // e.g. only a monthly price was given and this subscriber is annual

      const firstName = (p.name || "").split(" ")[0] || "there";
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><style>:root{color-scheme:light;}</style></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:28px 36px;text-align:center;">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;">
        <svg viewBox="0 0 48 48" fill="none" width="28" height="28">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34.5 L37 34.5" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="24" cy="18.3" r="1.8" fill="#C16140"/>
        </svg>
        <span style="color:#F4EDDF;font-size:20px;font-family:Georgia,serif;">Steadwell</span>
      </div>
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#F4EDDF;font-weight:400;margin:0;">An update to your plan price</h1>
    </div>
    <div style="padding:28px 36px;">
      <div style="font-size:14px;color:#2A2723;line-height:1.7;margin-bottom:24px;">
        Hi ${escapeHtml(firstName)},<br><br>
        Starting <strong>${effectiveLabel}</strong>, the price of Steadwell ${p.plan === "pro" ? "Pro" : "Plus"} (${p.plan_interval}) will change to <strong>${escapeHtml(relevantPrice)}</strong>.
        ${note ? `<br><br>${escapeHtml(note)}` : ""}
        <br><br>
        This won't affect you before ${effectiveLabel}. If you'd rather not continue at the new price, you can cancel anytime before then from Account Settings and you'll keep access through the end of your current billing period.
      </div>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${BASE_URL}/" style="display:inline-block;background:#C16140;color:#fff;text-decoration:none;padding:12px 28px;border-radius:40px;font-size:15px;font-weight:700;">Manage subscription</a>
      </div>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>
      <p style="font-size:11px;color:#A8A09A;margin:6px 0 0;">${MAILING_ADDRESS}</p>
      <p style="font-size:11px;color:#A8A09A;margin:6px 0 0;">This is a billing notice tied to your active subscription. Questions? <a href="mailto:hello@trysteadwell.app" style="color:#A8A09A;">hello@trysteadwell.app</a></p>
    </div>
  </div>
</body></html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [p.email],
          subject: `Your Steadwell ${p.plan === "pro" ? "Pro" : "Plus"} price is changing on ${effectiveLabel}`,
          html,
          headers: {
            "List-Unsubscribe": "<mailto:hello@trysteadwell.app?subject=Unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });

      if (res.ok) { sent++; } else {
        failed++;
        console.error(`[send-price-change-notice] Failed for ${p.user_id}:`, await res.text());
      }
    }

    await supabase.from("system_alerts").insert([{
      source: "send-price-change-notice",
      message: `Sent by ${user.email}: plan=${plan} effective=${effectiveDate} sent=${sent} failed=${failed}`,
    }]);

    return new Response(JSON.stringify({ ok: true, sent, failed, effectiveDate: effective.toISOString().slice(0, 10) }), { headers: CORS });

  } catch (err) {
    console.error("[send-price-change-notice] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
