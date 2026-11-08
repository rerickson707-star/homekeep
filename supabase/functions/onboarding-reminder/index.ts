// supabase/functions/onboarding-reminder/index.ts
//
// Sends up to TWO reminder emails to people who created a Steadwell account but
// never finished setting up their home:
//   1) about a day after signup
//   2) five days after the first one (the last one; nothing is sent after it)
// Skips anyone who finished onboarding, unsubscribed, was invited to someone
// else's home, or hasn't verified their email.
//
// Deploy:  npx supabase functions deploy onboarding-reminder --no-verify-jwt
// Needs the secrets RESEND_API_KEY and SERVICE_ROLE_KEY (already set) plus its own ONBOARDING_REMINDER_SECRET.
// Run daily by a pg_cron job (see cron.sql). Callers must send the header x-cron-secret.
//
// Manual calls (send the same x-cron-secret header):
//   {"test": true}      sends both emails to hello@trysteadwell.app only, writes nothing
//   {"dry_run": true}   lists who WOULD be emailed, sends nothing, writes nothing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const CRON_SECRET    = Deno.env.get("ONBOARDING_REMINDER_SECRET") || "";
const FROM           = "Steadwell <hello@trysteadwell.app>";
const APP_URL        = "https://www.trysteadwell.app";
const TEST_TO        = "hello@trysteadwell.app";
const ADDRESS        = "Steadwell LLC \u00B7 7901 4th Street N. Suite 36148, St. Petersburg, FL 33702";

// Steadwell house mark (108x108 PNG, shown at 36px), sent as an inline image so it shows in Gmail/Outlook without any hosting.
const LOGO_PNG_B64 = "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";
const LOGO_CID = "steadwell-logo";

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;
const FIRST_MIN_AGE   = 22 * HOUR;   // first email: at least ~a day after signup...
const FIRST_MAX_AGE   = 4 * DAY;     // ...and not for accounts older than 4 days (no late first emails)
const SECOND_MIN_GAP  = 4.9 * DAY;   // second email: ~5 days after the first
const SECOND_MAX_AGE  = 14 * DAY;
const MAX_PER_RUN     = 25;          // safety cap

// BEGIN-BUILDER (pure functions: no network, no database)
type Candidate = {
  user_id: string; email: string; first_name: string | null;
  created_at: string; reminder1_sent_at: string | null; reminder2_sent_at: string | null;
};

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstNameOf(c: { first_name: string | null; email: string }): string {
  const raw = (c.first_name || "").trim().split(/\s+/)[0] || "";
  // Skip anything that does not look like a real first name (e.g. an email-style handle).
  return raw && /^[\p{L}][\p{L}'\u2019-]*$/u.test(raw) ? raw : "";
}

// Which email (1 or 2) is due for this person right now, or null.
function stageFor(c: Candidate, nowMs: number): 1 | 2 | null {
  const age = nowMs - new Date(c.created_at).getTime();
  if (!c.reminder1_sent_at) {
    return age >= FIRST_MIN_AGE && age <= FIRST_MAX_AGE ? 1 : null;
  }
  if (!c.reminder2_sent_at) {
    const sinceFirst = nowMs - new Date(c.reminder1_sent_at).getTime();
    return sinceFirst >= SECOND_MIN_GAP && age <= SECOND_MAX_AGE ? 2 : null;
  }
  return null;
}

function buildEmail(stage: 1 | 2, opts: { firstName: string; unsubUrl: string }) {
  const hi = opts.firstName ? `Hi ${escapeHtml(opts.firstName)},` : "Hi there,";
  const hiText = opts.firstName ? `Hi ${opts.firstName},` : "Hi there,";
  const ctaUrl = APP_URL;

  let subject: string, heading: string, paras: string[], bullets: string[] = [], tail: string;
  if (stage === 1) {
    subject = "One step left to set up your Steadwell account";
    heading = "One step left to set up your home";
    paras = [
      "Thanks for creating your Steadwell account. You're signed in, but we haven't added your home yet. It takes about two minutes, and it's what lets Steadwell start working for you.",
    ];
    bullets = [
      "Track warranties and get a reminder before they expire",
      "Set up maintenance reminders for the things that matter in your house",
      "Keep appliance details, receipts and documents in one place",
    ];
    tail = "Questions? Just reply to this email and we'll help.";
  } else {
    subject = "Your Steadwell account is ready when you are";
    heading = "Your home is still waiting";
    paras = [
      "A few days ago you created a Steadwell account, but your home still isn't set up. If you'd like to pick it back up, it takes about two minutes.",
    ];
    tail = "This is the last reminder we'll send. If something got in the way, reply and tell us. We read every reply.";
  }

  const p = (t: string, mb = 14) => `<p style="margin:0 0 ${mb}px;font-size:15px;line-height:1.6;">${t}</p>`;
  const lead = stage === 1 ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Once your home is added, you can:</p>` : "";
  const ul = bullets.length
    ? `<ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:32px 16px;background:#F4EDDF;font-family:Arial,Helvetica,sans-serif;color:#2A2723;">
<div style="max-width:560px;margin:0 auto;background:#FFFDF8;border:1px solid #E0D8C9;border-radius:14px;overflow:hidden;">
  <div style="padding:20px 32px;background:#234A3D;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:10px;"><img src="cid:${LOGO_CID}" width="36" height="36" alt="" style="display:block;border:0;"></td>
      <td style="vertical-align:middle;color:#F4EDDF;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.2px;">Steadwell</td>
    </tr></table>
  </div>
  <div style="padding:30px 32px 8px;">
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:normal;color:#2A2723;">${heading}</h1>
    ${p(hi)}
    ${paras.map((t) => p(t)).join("\n    ")}
    ${lead}${ul}
    <p style="margin:0 0 26px;"><a href="${ctaUrl}" style="display:inline-block;background:#C16140;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">Finish setting up</a></p>
    ${p(tail)}
    ${p("The Steadwell Team", 26)}
  </div>
  <div style="padding:16px 32px 22px;border-top:1px solid #E0D8C9;font-size:12px;line-height:1.6;color:#8A827A;">
    You're getting this note because you created a Steadwell account with this email address.<br>
    ${escapeHtml(ADDRESS)}<br>
    <a href="${opts.unsubUrl}" style="color:#8A827A;">Unsubscribe</a>
  </div>
</div></body></html>`;

  const text = [
    hiText, "",
    ...paras, "",
    ...(stage === 1 ? ["Once your home is added, you can:", ...bullets.map((b) => `- ${b}`), ""] : []),
    `Finish setting up: ${ctaUrl}`, "",
    tail, "",
    "The Steadwell Team", "",
    "--",
    "You're getting this note because you created a Steadwell account with this email address.",
    ADDRESS,
    `Unsubscribe: ${opts.unsubUrl}`,
  ].join("\n");

  return { subject, html, text };
}
// END-BUILDER

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") { try { return JSON.stringify(e); } catch (_) { /* fall through */ } }
  return String(e);
}

async function sendEmail(to: string, subject: string, html: string, text: string, unsubUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      text,
      attachments: [{ filename: "steadwell-logo.png", content: LOGO_PNG_B64, content_id: LOGO_CID, content_type: "image/png" }],
      headers: { "List-Unsubscribe": `<${unsubUrl}>, <mailto:hello@trysteadwell.app?subject=Unsubscribe>` },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, detail: body };
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (CRON_SECRET.length < 16 || (req.headers.get("x-cron-secret") || "") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  const body = await req.json().catch(() => ({}));
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Test mode: both emails to the company inbox only. Writes nothing.
  if (body?.test) {
    const dummy = `${APP_URL}/unsubscribe?token=00000000-0000-0000-0000-000000000000`;
    const out: unknown[] = [];
    for (const stage of [1, 2] as const) {
      const m = buildEmail(stage, { firstName: "Robert", unsubUrl: dummy });
      out.push({ stage, ...(await sendEmail(TEST_TO, `[TEST ${stage} of 2] ${m.subject}`, m.html, m.text, dummy)) });
    }
    return json({ ok: true, test: true, sent_to: TEST_TO, results: out });
  }

  try {
    const { data, error } = await supabase.rpc("onboarding_reminder_candidates");
    if (error) throw error;

    const now = Date.now();
    const due = ((data ?? []) as Candidate[])
      .map((c) => ({ c, stage: stageFor(c, now) }))
      .filter((x): x is { c: Candidate; stage: 1 | 2 } => x.stage !== null);

    if (body?.dry_run) {
      return json({ ok: true, dry_run: true, considered: (data ?? []).length, would_send: due.map((x) => ({ email: x.c.email, stage: x.stage })) });
    }

    const result = { considered: (data ?? []).length, sent: 0, failed: 0, skipped_over_cap: 0 };
    for (const { c, stage } of due) {
      if (result.sent + result.failed >= MAX_PER_RUN) { result.skipped_over_cap++; continue; }

      // Record the send BEFORE sending so an overlapping run can never double-send.
      const col = stage === 1 ? "reminder1_sent_at" : "reminder2_sent_at";
      const { error: claimErr } = await supabase.from("onboarding_reminders")
        .upsert({ user_id: c.user_id, email: c.email, [col]: new Date().toISOString() }, { onConflict: "user_id" });
      if (claimErr) { result.failed++; console.error("[onboarding-reminder] claim failed:", errMsg(claimErr)); continue; }

      const unsubUrl = `${APP_URL}/unsubscribe?token=${c.user_id}`;
      const m = buildEmail(stage, { firstName: firstNameOf(c), unsubUrl });
      let ok = false, detail: unknown = null;
      try { ({ ok, detail } = await sendEmail(c.email, m.subject, m.html, m.text, unsubUrl)); }
      catch (e) { detail = errMsg(e); }

      if (ok) { result.sent++; }
      else {
        result.failed++;
        console.error("[onboarding-reminder] send failed:", c.user_id, detail);
        // Release the claim so tomorrow's run can try again (still inside the time window).
        await supabase.from("onboarding_reminders").update({ [col]: null }).eq("user_id", c.user_id);
      }
    }

    if (result.failed > 0) {
      await supabase.from("system_alerts").insert([{ source: "onboarding-reminder", message: `Run completed with failures: ${JSON.stringify(result)}` }]);
    }
    console.log("[onboarding-reminder] Run complete:", result);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[onboarding-reminder] Fatal error:", errMsg(e));
    try {
      await supabase.from("system_alerts").insert([{ source: "onboarding-reminder", message: `Fatal error: ${errMsg(e)}` }]);
    } catch (_) { /* best-effort */ }
    return json({ error: errMsg(e) }, 500);
  }
});
