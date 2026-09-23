// supabase/functions/renewal-reminder/index.ts
//
// Sends the two reminder emails the Terms of Service (Section 5, "Plans and
// Pricing") promise:
//   - Annual subscribers: an email 30-40 days before each renewal date.
//   - Monthly subscribers: an annual reminder of the recurring charge, sent
//     on the anniversary of when they started the plan (monthly subscribers
//     don't have a single yearly renewal date the way annual ones do, so
//     plan_started_at — set by stripe-webhook at checkout — is the anchor).
//
// Run daily via cron (see the SQL at the bottom of this comment). Each run
// re-queries both groups; the last_*_sent_at columns stop a subscriber who
// sits inside the matching window for several days in a row from getting
// the email more than once per cycle.
//
// Deploy: npx supabase functions deploy renewal-reminder --no-verify-jwt
// (cron invokes this via pg_net with the service role key, not a user JWT --
// same pattern as gift-expiry-check.)
//
// Register the daily cron once, in the SQL editor:
//   select cron.schedule(
//     'renewal-reminder-daily',
//     '0 13 * * *',  -- 9am Eastern
//     $$
//     select net.http_post(
//       url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/renewal-reminder',
//       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json')
//     );
//     $$
//   );

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";
const BASE_URL              = "https://www.trysteadwell.app";

// Same placeholder pattern used in send-gift-email.ts -- swap in a real
// value via the COMPANY_MAILING_ADDRESS env var once a PO box exists.
const MAILING_ADDRESS = Deno.env.get("COMPANY_MAILING_ADDRESS")
  || "Steadwell, LLC — mailing address pending, see hello@trysteadwell.app";

// Must match PRICE_TO_PLAN in stripe-webhook.ts and Section 5 of the Terms.
const PLAN_PRICING: Record<string, { monthly: string; annual: string }> = {
  plus: { monthly: "$7.99/month", annual: "$63.99/year" },
  pro:  { monthly: "$14.99/month", annual: "$119.99/year" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// True if `sentAt` (an ISO string or null) is recent enough that we should
// treat this cycle's reminder as already sent. 300 days comfortably covers
// the ~10-day window a subscriber sits inside either trigger condition,
// while still being short enough that a genuinely new cycle a year later
// always clears it.
function alreadySentThisCycle(sentAt: string | null): boolean {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() < 300 * DAY_MS;
}

// Same-month-and-day check for the monthly "annual reminder" anchor, with a
// 1-day tolerance each side so a delayed cron run or a leap-year Feb 29
// anchor doesn't silently skip a year.
function isNearAnniversary(startedAt: Date, today: Date): boolean {
  const anniversary = new Date(today.getFullYear(), startedAt.getMonth(), startedAt.getDate());
  const diffDays = Math.abs((today.getTime() - anniversary.getTime()) / DAY_MS);
  return diffDays <= 1;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function emailShell(opts: { preheader: string; heading: string; body: string; ctaLabel: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <style>:root{color-scheme:light;}</style>
</head>
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
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#F4EDDF;font-weight:400;margin:0;">${opts.heading}</h1>
    </div>
    <div style="padding:28px 36px;">
      <div style="font-size:14px;color:#2A2723;line-height:1.7;margin-bottom:24px;">${opts.body}</div>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${BASE_URL}/" style="display:inline-block;background:#C16140;color:#fff;text-decoration:none;padding:12px 28px;border-radius:40px;font-size:15px;font-weight:700;">${opts.ctaLabel}</a>
      </div>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>
      <p style="font-size:11px;color:#A8A09A;margin:6px 0 0;">${MAILING_ADDRESS}</p>
      <p style="font-size:11px;color:#A8A09A;margin:6px 0 0;">This is a billing notice tied to your active subscription. Manage or cancel anytime from Account Settings. Questions? <a href="mailto:hello@trysteadwell.app" style="color:#A8A09A;">hello@trysteadwell.app</a></p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; detail?: unknown }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      headers: {
        "List-Unsubscribe": "<mailto:hello@trysteadwell.app?subject=Unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  const result = await res.json();
  if (!res.ok) return { ok: false, detail: result };
  return { ok: true };
}

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const now = new Date();
  const results = { annual_sent: 0, annual_failed: 0, monthly_sent: 0, monthly_failed: 0 };

  try {
    // ── Annual subscribers: 30-40 days before plan_expires_at ──────────────
    const windowStart = addDays(now, 30).toISOString();
    const windowEnd    = addDays(now, 40).toISOString();

    const { data: annualCandidates, error: annualErr } = await supabase
      .from("profiles")
      .select("user_id, email, name, plan, plan_interval, plan_expires_at, last_renewal_reminder_sent_at")
      .in("plan", ["plus", "pro"])
      .eq("plan_interval", "annual")
      .not("stripe_subscription_id", "is", null)
      .gte("plan_expires_at", windowStart)
      .lte("plan_expires_at", windowEnd);

    if (annualErr) throw annualErr;

    for (const p of annualCandidates ?? []) {
      if (!p.email) { console.error(`[renewal-reminder] No email on profile ${p.user_id}, skipping`); continue; }
      if (alreadySentThisCycle(p.last_renewal_reminder_sent_at)) continue;

      const price = PLAN_PRICING[p.plan]?.annual ?? "your plan price";
      const renewDate = new Date(p.plan_expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const firstName = (p.name || "").split(" ")[0] || "there";

      const html = emailShell({
        preheader: `Your Steadwell ${p.plan === "pro" ? "Pro" : "Plus"} plan renews on ${renewDate}`,
        heading: "Your plan renews soon",
        body: `Hi ${escapeHtml(firstName)},<br><br>Just a heads-up: your Steadwell ${p.plan === "pro" ? "Pro" : "Plus"} subscription renews on <strong>${renewDate}</strong> at <strong>${price}</strong>. It'll renew automatically — no action needed if you want to keep it.<br><br>If you'd rather not renew, you can cancel anytime before that date from Account Settings and you'll keep access through the end of your current billing period.`,
        ctaLabel: "Manage subscription",
      });

      const sendResult = await sendEmail(p.email, `Your Steadwell plan renews on ${renewDate}`, html);
      if (sendResult.ok) {
        results.annual_sent++;
        await supabase.from("profiles").update({ last_renewal_reminder_sent_at: now.toISOString() }).eq("user_id", p.user_id);
      } else {
        results.annual_failed++;
        console.error(`[renewal-reminder] Annual send failed for ${p.user_id}:`, sendResult.detail);
      }
    }

    // ── Monthly subscribers: once a year, on the plan_started_at anniversary ─
    const { data: monthlyCandidates, error: monthlyErr } = await supabase
      .from("profiles")
      .select("user_id, email, name, plan, plan_interval, plan_started_at, last_annual_charge_reminder_sent_at")
      .in("plan", ["plus", "pro"])
      .eq("plan_interval", "monthly")
      .not("stripe_subscription_id", "is", null)
      .not("plan_started_at", "is", null);

    if (monthlyErr) throw monthlyErr;

    for (const p of monthlyCandidates ?? []) {
      if (!p.email) { console.error(`[renewal-reminder] No email on profile ${p.user_id}, skipping`); continue; }
      const startedAt = new Date(p.plan_started_at);
      if (!isNearAnniversary(startedAt, now)) continue;
      if (alreadySentThisCycle(p.last_annual_charge_reminder_sent_at)) continue;

      const price = PLAN_PRICING[p.plan]?.monthly ?? "your plan price";
      const firstName = (p.name || "").split(" ")[0] || "there";
      const years = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / (365.25 * DAY_MS)));

      const html = emailShell({
        preheader: `You're on Steadwell ${p.plan === "pro" ? "Pro" : "Plus"} at ${price}`,
        heading: "Your yearly billing reminder",
        body: `Hi ${escapeHtml(firstName)},<br><br>It's been ${years} year${years === 1 ? "" : "s"} since you joined Steadwell ${p.plan === "pro" ? "Pro" : "Plus"}. Just a once-a-year reminder that you're billed <strong>${price}</strong>, charged automatically each month.<br><br>Everything's running fine — no action needed. If you'd like to change or cancel your plan, you can do that anytime from Account Settings.`,
        ctaLabel: "Manage subscription",
      });

      const sendResult = await sendEmail(p.email, `Your Steadwell billing: ${price}`, html);
      if (sendResult.ok) {
        results.monthly_sent++;
        await supabase.from("profiles").update({ last_annual_charge_reminder_sent_at: now.toISOString() }).eq("user_id", p.user_id);
      } else {
        results.monthly_failed++;
        console.error(`[renewal-reminder] Monthly send failed for ${p.user_id}:`, sendResult.detail);
      }
    }

    if (results.annual_failed > 0 || results.monthly_failed > 0) {
      await supabase.from("system_alerts").insert([{
        source: "renewal-reminder",
        message: `Run completed with failures: ${JSON.stringify(results)}`,
      }]);
    }

    console.log("[renewal-reminder] Run complete:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[renewal-reminder] Fatal error:", err);
    try {
      const supabase2 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
      await supabase2.from("system_alerts").insert([{
        source: "renewal-reminder",
        message: `Fatal error: ${err?.message || String(err)}`,
      }]);
    } catch (_) { /* best-effort */ }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
