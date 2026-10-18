// supabase/functions/delete-account/index.ts
// Deploy: npx supabase functions deploy delete-account --no-verify-jwt --project-ref hjkyameroqufaojuerns
// (The function checks the caller's own login token itself, so the gateway check stays off.)
//
// "Delete my account", start of the 30-day grace period:
//   1. Checks the login token belongs to the account being deleted.
//   2. Cancels the paid plan (so nobody keeps getting billed for an account they deleted).
//   3. Ends everyone else's access to the person's homes right away, and emails them once
//      (sw_account_begin_deletion; run steadwell-account-deletion.sql first).
//   4. Soft-deletes the login (sign-in stops working). The data waits for purge-deleted-accounts,
//      which erases it for good after 30 days.
//   5. Saves the exit survey and emails hello@trysteadwell.app.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("DB_URL")!;
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PLAN_RANK: Record<string, number> = { free: 0, plus: 1, pro: 2 };

async function sendCancellationNotification(opts: {
  email: string; name: string | null; plan: string; reason: string; details: string | null; accountCreated: string | null;
  peopleRemoved: number; billing: string;
}) {
  const { email, name, plan, reason, details, accountCreated, peopleRemoved, billing } = opts;
  const ageLine = accountCreated
    ? (() => { const days = Math.floor((Date.now() - new Date(accountCreated).getTime()) / 86400000); return `${days} day${days === 1 ? "" : "s"}`; })()
    : "unknown";
  const row = (label: string, value: string, last = false) =>
    `<tr${last ? "" : ' style="border-bottom:1px solid #E6DECF;"'}><td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;width:130px;">${label}</td><td style="padding:10px 0;font-size:15px;color:#2A2723;">${value}</td></tr>`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ECE3D2;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:24px 32px;"><span style="color:#F4EDDF;font-size:18px;font-weight:700;font-family:Georgia,serif;">Account deleted</span></div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row("Email", esc(email))}
        ${name ? row("Name", esc(name)) : ""}
        ${row("Plan", esc(plan))}
        ${row("Account age", esc(ageLine))}
        ${row("People removed", String(peopleRemoved))}
        ${row("Billing", esc(billing), true)}
      </table>
      <div style="margin-top:20px;padding:16px 18px;background:#F7E0DA;border-radius:10px;border-left:3px solid #C16140;">
        <div style="font-size:13px;font-weight:700;color:#B0432B;margin-bottom:6px;">Reason given</div>
        <div style="font-size:14px;color:#2A2723;line-height:1.5;">${esc(reason)}</div>
        ${details ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #E3B2A6;font-size:13px;color:#5A534B;line-height:1.6;white-space:pre-wrap;">${esc(details)}</div>` : ""}
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell &middot; 30-day grace period, then the data is erased automatically</p>
    </div>
  </div>
</body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Steadwell <hello@trysteadwell.app>",
      to: ["hello@trysteadwell.app"],
      subject: `${billing.startsWith("CHECK") ? "CHECK BILLING: " : ""}Account deleted: ${email} (${reason})`,
      html,
    }),
  });
  // Resend answers with an error body instead of throwing, so check it: a silent failure here hides the deletion from hello@.
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const accessToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!accessToken) return new Response(JSON.stringify({ ok: false, error: "Missing auth token" }), { status: 401, headers: CORS });

    const { userId, reason, details } = await req.json();
    if (!userId) return new Response(JSON.stringify({ ok: false, error: "userId required" }), { status: 400, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // The token must belong to the account being deleted. Nobody can delete someone else by guessing an ID.
    const { data: tokenUser, error: tokenErr } = await supabase.auth.getUser(accessToken);
    if (tokenErr || !tokenUser?.user || tokenUser.user.id !== userId) {
      return new Response(JSON.stringify({ ok: false, error: "Not authorized to delete this account" }), { status: 403, headers: CORS });
    }
    const email = tokenUser.user.email || "unknown";
    const accountCreated = tokenUser.user.created_at || null;

    // A person with several homes has several profile rows. Use the highest plan and the first name.
    const { data: profs } = await supabase.from("profiles").select("name, plan, plan_cancel_at, created_at").eq("user_id", userId).order("created_at", { ascending: true });
    const rows = profs || [];
    const name = rows.find((p: any) => p.name)?.name || null;
    const plan = rows.reduce((best: string, p: any) => ((PLAN_RANK[String(p.plan || "free")] ?? 0) > (PLAN_RANK[best] ?? 0) ? String(p.plan) : best), "free");
    const paid = plan !== "free";
    const alreadyCancelling = rows.some((p: any) => p.plan_cancel_at);

    // 1. Stop the billing. The existing cancel-subscription function does the Stripe work, using the person's own token.
    //    If it fails, deletion still goes ahead (someone who wants out should be out), but hello@ is told to check Stripe.
    let billing = paid ? "" : "Free plan";
    if (paid) {
      if (alreadyCancelling) {
        billing = "Already set to cancel";
      } else {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          });
          const out = await res.json().catch(() => ({}));
          billing = res.ok && out?.ok ? "Cancelled at the end of the paid period" : `CHECK STRIPE: cancel failed (${out?.error || res.status})`;
        } catch (e) {
          billing = `CHECK STRIPE: cancel failed (${(e as Error).message})`;
        }
      }
    }

    // 2. End everyone else's access to this person's homes now, and queue one email to each of them.
    const { data: removed, error: beginErr } = await supabase.rpc("sw_account_begin_deletion", { p_user: userId });
    if (beginErr) throw new Error("Could not end shared access: " + beginErr.message);
    const peopleRemoved = Number(removed || 0);

    // Send those emails now, with this person's still-valid login (the sender only needs a valid login, nothing else).
    if (peopleRemoved > 0) {
      try {
        const ping = await fetch(`${SUPABASE_URL}/functions/v1/send-notifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: "{}",
        });
        if (!ping.ok) console.error("[delete-account] send-notifications answered", ping.status, (await ping.text().catch(() => "")).slice(0, 200));
        // (a non-OK answer is logged below; the next ping from anyone sends them)
      } catch (e) { console.error("[delete-account] could not ping send-notifications:", (e as Error).message); }
    }

    // 3. Soft delete: sign-in stops, data waits out the grace period.
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId, true);
    if (deleteErr) throw new Error(deleteErr.message);

    await supabase.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("user_id", userId).is("deletion_requested_at", null);

    // 4. Exit survey and heads-up to hello@. Best effort, after the deletion has actually happened.
    const warnings: string[] = [];
    try {
      const { error: fbErr } = await supabase.from("cancellation_feedback").insert({ user_id: userId, email, plan, reason: reason || "Not provided", details: details || null });
      if (fbErr) { warnings.push("exit_survey_not_saved"); console.error("[delete-account] exit survey not saved:", fbErr.message); }
    } catch (e) { warnings.push("exit_survey_not_saved"); console.error("[delete-account] exit survey not saved:", (e as Error).message); }
    try {
      await sendCancellationNotification({ email, name, plan, reason: reason || "Not provided", details: details || null, accountCreated, peopleRemoved, billing });
    } catch (e) { warnings.push("hello_email_not_sent"); console.error("[delete-account] email to hello@ not sent:", (e as Error).message); }

    return new Response(JSON.stringify({ ok: true, ...(warnings.length ? { warnings } : {}) }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 500, headers: CORS });
  }
});
