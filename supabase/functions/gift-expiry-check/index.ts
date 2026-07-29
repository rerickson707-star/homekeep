// supabase/functions/gift-expiry-check/index.ts
// Daily cron — finds gift Plus users expiring in 7 days, 1 day, or today
// Sends personalized expiry drip emails and auto-downgrades on day 90
// Deploy: npx supabase functions deploy gift-expiry-check --no-verify-jwt
// Cron:   0 9 * * *  (9am UTC daily — same pattern as warranty-alerts)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";
const BASE_URL              = "https://www.trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

async function getUserUsage(userId: string) {
  const [docs, warranties, expenses, tasks, scannedDocs] = await Promise.all([
    supabase.from("home_documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("warranties").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("retired_at", null),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("home_documents").select("id", { count: "exact", head: true })
      .eq("user_id", userId).not("file_url", "is", null).neq("file_url", ""),
  ]);
  return {
    docCount:      docs.count      || 0,
    warrantyCount: warranties.count || 0,
    expenseCount:  expenses.count  || 0,
    taskCount:     tasks.count     || 0,
    scannedCount:  scannedDocs.count || 0,
  };
}

async function getAgentName(agentToken: string | null): Promise<string | null> {
  if (!agentToken) return null;
  const { data } = await supabase
    .from("agent_applications")
    .select("display_name, name")
    .eq("token", agentToken)
    .single();
  return data ? (data.display_name || data.name || null) : null;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error(`[gift-expiry-check] Resend error for ${to}:`, err);
  }
  return res.ok;
}

// ── Email builders ────────────────────────────────────────────────────────────

function emailWrapper(body: string): string {
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
    <div style="background:#234A3D;padding:20px 36px;display:flex;align-items:center;gap:10px;">
      <svg viewBox="0 0 48 48" fill="none" width="22" height="22">
        <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
      </svg>
      <span style="color:#F4EDDF;font-size:18px;font-weight:700;font-family:Georgia,serif;">Steadwell</span>
    </div>
    <div style="padding:32px 36px;">
      ${body}
    </div>
    <div style="padding:16px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">
        Steadwell · <a href="${BASE_URL}" style="color:#A8A09A;">trysteadwell.app</a>
        · <a href="${BASE_URL}/account" style="color:#A8A09A;">Manage account</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="background:#C16140;color:#fff;text-decoration:none;padding:14px 32px;border-radius:40px;font-size:15px;font-weight:700;display:inline-block;">${text}</a>
  </div>`;
}

function buildEmail7Day(firstName: string, agentName: string | null, usage: Awaited<ReturnType<typeof getUserUsage>>): { subject: string; html: string } {
  const { docCount, warrantyCount, expenseCount, taskCount } = usage;

  const statsHtml = [
    warrantyCount > 0 && `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E6DECF;font-size:13px;"><span style="color:#7A7370;">Warranties & assets tracked</span><span style="font-weight:700;color:#234A3D;">${warrantyCount}</span></div>`,
    expenseCount > 0  && `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E6DECF;font-size:13px;"><span style="color:#7A7370;">Expenses logged</span><span style="font-weight:700;color:#234A3D;">${expenseCount}</span></div>`,
    docCount > 0      && `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E6DECF;font-size:13px;"><span style="color:#7A7370;">Documents stored</span><span style="font-weight:700;color:#234A3D;">${docCount}</span></div>`,
    taskCount > 0     && `<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:13px;"><span style="color:#7A7370;">Maintenance tasks</span><span style="font-weight:700;color:#234A3D;">${taskCount}</span></div>`,
  ].filter(Boolean).join("");

  const hasUsage = warrantyCount + expenseCount + docCount + taskCount > 0;
  const giftedByLine = agentName
    ? `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your gift from ${agentName} ends in <strong>7 days</strong>.</p>`
    : `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your Steadwell Plus gift ends in <strong>7 days</strong>.</p>`;

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#234A3D;font-weight:400;margin:0 0 8px;">Your Plus access is almost up, ${firstName}.</h1>
    ${giftedByLine}
    ${hasUsage ? `
    <div style="background:#F4EDDF;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A8A09A;margin-bottom:8px;">What you've built in Steadwell</div>
      ${statsHtml || `<div style="font-size:13px;color:#7A7370;">Your home data is safe and ready.</div>`}
    </div>` : ""}
    <p style="font-size:13px;color:#2A2723;line-height:1.7;margin:0 0 16px;">Keep access to AI scanning, your full document vault, cost forecasting, and your home health score — all the tools that make Steadwell worth having beyond the first 90 days.</p>
    <p style="font-size:13px;color:#2A2723;line-height:1.7;margin:0 0 8px;"><strong>Plus is $7.99/month</strong> — less than a coffee.</p>
    ${ctaButton("Keep my Plus access →", `${BASE_URL}/?upgrade=plus`)}
    <p style="font-size:12px;color:#A8A09A;text-align:center;margin:0;">Or upgrade from <strong>Account → Billing</strong> anytime before your trial ends.</p>`;

  return {
    subject: `Your Steadwell Plus access ends in 7 days`,
    html: emailWrapper(body),
  };
}

function buildEmail1Day(firstName: string, agentName: string | null, usage: Awaited<ReturnType<typeof getUserUsage>>): { subject: string; html: string } {
  const { docCount, scannedCount } = usage;
  const overLimit = Math.max(0, docCount - 5);

  const lossItems = [
    scannedCount > 0 && `AI receipt and nameplate scanning <span style="color:#A8A09A;font-size:11px;">(${scannedCount} scanned file${scannedCount !== 1 ? "s" : ""})</span>`,
    overLimit > 0    && `${overLimit} document${overLimit !== 1 ? "s" : ""} over the free limit of 5`,
    `Home health score`,
    `5-year cost forecast`,
    `Full recurring maintenance schedules`,
  ].filter(Boolean);

  const lossHtml = lossItems.map(item =>
    `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #F4EDDF;font-size:13px;color:#2A2723;">
      <span style="color:#C16140;font-weight:700;flex-shrink:0;margin-top:1px;">✕</span>${item}
    </div>`
  ).join("");

  const giftedByLine = agentName
    ? `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your gift from ${agentName} ends <strong>tomorrow</strong>.</p>`
    : `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your Steadwell Plus gift ends <strong>tomorrow</strong>.</p>`;

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#234A3D;font-weight:400;margin:0 0 8px;">Tomorrow your Plus access ends, ${firstName}.</h1>
    ${giftedByLine}
    <div style="background:#FDF3EE;border:1px solid #F5D5B0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A0511A;margin-bottom:10px;">What you'll lose on the free plan</div>
      ${lossHtml}
    </div>
    <p style="font-size:13px;color:#2A2723;line-height:1.7;margin:0 0 16px;">Upgrade tonight and nothing changes — your data stays, your access continues, and you keep everything you've built.</p>
    ${ctaButton("Upgrade before it expires →", `${BASE_URL}/?upgrade=plus`)}
    <p style="font-size:12px;color:#A8A09A;text-align:center;margin:0;line-height:1.6;">Plus is $7.99/month · $63.99/year · Cancel anytime</p>`;

  return {
    subject: `Your Steadwell Plus ends tomorrow — here's what changes`,
    html: emailWrapper(body),
  };
}

function buildEmailExpired(firstName: string, agentName: string | null, usage: Awaited<ReturnType<typeof getUserUsage>>): { subject: string; html: string } {
  const { docCount } = usage;
  const overLimit = Math.max(0, docCount - 5);

  const giftedByLine = agentName
    ? `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your 90-day gift from ${agentName} has now ended.</p>`
    : `<p style="font-size:13px;color:#7A7370;margin:0 0 20px;">Your 90-day Steadwell Plus trial has ended.</p>`;

  const overLimitNote = overLimit > 0
    ? `<div style="background:#FDF3EE;border:1px solid #F5D5B0;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#A0511A;">
        <strong>Heads up:</strong> You have ${docCount} documents stored — the free plan includes 5. Your ${overLimit} extra file${overLimit !== 1 ? "s" : ""} are safe but locked until you upgrade.
      </div>`
    : "";

  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;color:#234A3D;font-weight:400;margin:0 0 8px;">Your Plus trial has ended, ${firstName}.</h1>
    ${giftedByLine}
    ${overLimitNote}
    <p style="font-size:13px;color:#2A2723;line-height:1.7;margin:0 0 8px;">Your account is still here — your home data, warranties, and expenses are all safe. You're now on the free plan, which includes core tracking features.</p>
    <p style="font-size:13px;color:#2A2723;line-height:1.7;margin:0 0 20px;">Upgrade anytime to get back AI scanning, your full document vault, the health score, and cost forecasting.</p>
    ${ctaButton("Upgrade to Plus →", `${BASE_URL}/?upgrade=plus`)}
    <p style="font-size:12px;color:#A8A09A;text-align:center;margin:0;line-height:1.6;">Plus $7.99/mo · Pro $14.99/mo · Cancel anytime</p>`;

  return {
    subject: `Your Steadwell Plus trial has ended`,
    html: emailWrapper(body),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const today    = dateOnly(new Date());
    const in7Days  = dateOnly(addDays(new Date(), 7));
    const in1Day   = dateOnly(addDays(new Date(), 1));

    // Fetch all three cohorts in parallel
    const [expiring7, expiring1, expiredToday] = await Promise.all([
      supabase.from("profiles")
        .select("user_id, gift_agent_token, plan, plan_cancel_at")
        .eq("plan", "plus")
        .not("gift_agent_token", "is", null)
        .gte("gift_expires_at", `${in7Days}T00:00:00`)
        .lt("gift_expires_at", `${in7Days}T23:59:59`),

      supabase.from("profiles")
        .select("user_id, gift_agent_token, plan, plan_cancel_at")
        .eq("plan", "plus")
        .not("gift_agent_token", "is", null)
        .gte("gift_expires_at", `${in1Day}T00:00:00`)
        .lt("gift_expires_at", `${in1Day}T23:59:59`),

      supabase.from("profiles")
        .select("user_id, gift_agent_token, plan, plan_cancel_at")
        .eq("plan", "plus")
        .not("gift_agent_token", "is", null)
        .is("plan_cancel_at", null)  // no Stripe subscription — safe to downgrade
        .gte("gift_expires_at", `${today}T00:00:00`)
        .lt("gift_expires_at", `${today}T23:59:59`),
    ]);

    const results = { sent: 0, downgrades: 0, errors: 0 };

    // Helper to process a cohort
    async function processCohort(
      profiles: { user_id: string; gift_agent_token: string | null }[],
      buildEmail: (firstName: string, agentName: string | null, usage: Awaited<ReturnType<typeof getUserUsage>>) => { subject: string; html: string },
      shouldDowngrade: boolean
    ) {
      for (const profile of profiles) {
        try {
          const [email, usage, agentName] = await Promise.all([
            getUserEmail(profile.user_id),
            getUserUsage(profile.user_id),
            getAgentName(profile.gift_agent_token),
          ]);

          if (!email) { results.errors++; continue; }

          const firstName = email.split("@")[0].split(/[._-]/)[0];
          const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

          const { subject, html } = buildEmail(displayName, agentName, usage);
          const sent = await sendEmail(email, subject, html);
          if (sent) results.sent++;
          else results.errors++;

          // Downgrade on expiry day
          if (shouldDowngrade) {
            const { error: downgradeErr } = await supabase
              .from("profiles")
              .update({ plan: "free" })
              .eq("user_id", profile.user_id);

            if (downgradeErr) {
              console.error(`[gift-expiry-check] Downgrade failed for ${profile.user_id}:`, downgradeErr);
              results.errors++;
            } else {
              results.downgrades++;
            }
          }
        } catch (err) {
          console.error(`[gift-expiry-check] Error processing ${profile.user_id}:`, err);
          results.errors++;
        }
      }
    }

    await processCohort(expiring7.data  || [], buildEmail7Day,   false);
    await processCohort(expiring1.data  || [], buildEmail1Day,   false);
    await processCohort(expiredToday.data || [], buildEmailExpired, true);

    console.log("[gift-expiry-check] Complete:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), { headers: CORS });

  } catch (err) {
    console.error("[gift-expiry-check] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
