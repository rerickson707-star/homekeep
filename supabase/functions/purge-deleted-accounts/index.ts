// supabase/functions/purge-deleted-accounts/index.ts
// Deploy: npx supabase functions deploy purge-deleted-accounts --no-verify-jwt --project-ref hjkyameroqufaojuerns
//
// The other half of "Delete my account". delete-account closes the login and ends shared access at once;
// this erases the data for good once the 30-day grace period is over, so the promise in Account settings
// and the Privacy Policy is actually kept.
//
// Who may call it: the daily schedule calls it with no key, like the other scheduled jobs. A call without the
// key can only do the normal run (accounts past 30 days, 10 at a time) and learns nothing but a count.
// With the service-role key you can also send:
//   { "dryRun": true }  -> lists who WOULD be erased and changes nothing
//   { "days": 30, "limit": 10 }
// Per account: lists the files to remove, hard-deletes the login (the database cleans up the rest in one
// step, see steadwell-account-deletion.sql), then removes the files.
// After every real run that erased (or failed to erase) anyone, it emails hello@trysteadwell.app a summary:
// who was erased, their plan, when they asked, and a CHECK STRIPE flag for any paid plan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const admin = createClient(Deno.env.get("DB_URL")!, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// One email per run that did anything. A failure to send is logged, never fatal: the erasure already happened.
async function sendPurgeSummary(batch: Array<{ user_id: string; label: string; requested: string; plan: string }>, results: Array<{ user_id: string; ok: boolean; files?: number; filesFailed?: number; error?: string }>, emails: Map<string, string>) {
  if (!RESEND_API_KEY) { console.error("[purge] summary not sent: RESEND_API_KEY is not set"); return; }
  const by = new Map(results.map((r) => [r.user_id, r]));
  const paid = batch.filter((b) => b.plan !== "free" && by.get(b.user_id)?.ok);
  const failed = results.filter((r) => !r.ok).length;
  const rows = batch.map((b) => {
    const r = by.get(b.user_id);
    const status = r?.ok ? `Erased${r.filesFailed ? ` (${r.filesFailed} files could not be removed)` : ""}` : `FAILED: ${esc(r?.error || "unknown")}`;
    const who = emails.get(b.user_id) || "(no email saved)";
    return `<tr style="border-bottom:1px solid #E6DECF;"><td style="padding:8px 6px;font-size:13px;">${esc(who)}<br><span style="color:#9A9088;">${esc(b.label || b.user_id)}</span></td><td style="padding:8px 6px;font-size:13px;">${esc(b.plan)}${b.plan !== "free" ? " &middot; <strong style=\"color:#B0432B;\">CHECK STRIPE</strong>" : ""}</td><td style="padding:8px 6px;font-size:13px;">${esc(String(b.requested).slice(0, 10))}</td><td style="padding:8px 6px;font-size:13px;">${status}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ECE3D2;margin:0;padding:0;"><div style="max-width:640px;margin:32px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;"><div style="background:#234A3D;padding:20px 28px;"><span style="color:#F4EDDF;font-size:17px;font-weight:700;font-family:Georgia,serif;">Accounts erased</span></div><div style="padding:22px 28px;"><p style="font-size:14px;color:#2A2723;margin:0 0 12px;">The daily purge erased ${results.filter((r) => r.ok).length} account${results.filter((r) => r.ok).length === 1 ? "" : "s"} after their 30 days${failed ? `, and ${failed} could not be erased` : ""}.${paid.length ? ` <strong style="color:#B0432B;">${paid.length} had a paid plan: confirm the subscription is cancelled in Stripe.</strong>` : ""}</p><table style="width:100%;border-collapse:collapse;"><tr style="text-align:left;color:#9A9088;font-size:12px;"><th style="padding:6px;">Account</th><th style="padding:6px;">Plan</th><th style="padding:6px;">Asked on</th><th style="padding:6px;">Result</th></tr>${rows}</table></div></div></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Steadwell <hello@trysteadwell.app>", to: ["hello@trysteadwell.app"], subject: `${paid.length ? "CHECK BILLING: " : ""}Accounts erased: ${results.filter((r) => r.ok).length}${failed ? ` (${failed} failed)` : ""}`, html }),
    });
    if (!res.ok) console.error("[purge] summary email failed", res.status, await res.text().catch(() => ""));
  } catch (e) { console.error("[purge] summary email failed", (e as Error).message); }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const privileged = !!token && token === SERVICE_KEY;
  // The daily schedule sends no key at all. Anything that sends a key or a request body but is not recognised is
  // refused outright, so a mistyped key can never fall through to a real run.
  const rawBody = req.headers.get("content-length") && req.headers.get("content-length") !== "0" ? await req.clone().text().catch(() => "") : "";
  const hasOptions = rawBody.trim() !== "" && rawBody.trim() !== "{}";
  if (!privileged && (token || hasOptions)) return json(401, { error: "not_authorized: the service-role key was not recognised, nothing was run" });

  try {
    const body = privileged ? await req.json().catch(() => ({})) : {};
    const dryRun = body?.dryRun === true;
    const days = Math.max(30, Number(body?.days) || 30);          // never sooner than the promised 30 days
    const limit = Math.min(25, Math.max(1, Number(body?.limit) || 10));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const { data: due, error } = await admin
      .from("profiles").select("user_id, name, address, plan, deletion_requested_at")
      .not("deletion_requested_at", "is", null).lt("deletion_requested_at", cutoff).not("user_id", "is", null)
      .order("deletion_requested_at", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);

    const people = new Map<string, { user_id: string; label: string; requested: string; plan: string }>();
    for (const p of due || []) {
      if (!people.has(p.user_id)) people.set(p.user_id, { user_id: p.user_id, label: String(p.name || p.address || ""), requested: p.deletion_requested_at, plan: String(p.plan || "free") });
      else if ((p.plan === "pro") || (p.plan === "plus" && people.get(p.user_id)!.plan === "free")) people.get(p.user_id)!.plan = String(p.plan);
    }
    const batch = [...people.values()].slice(0, limit);
    if (dryRun) return json(200, { ok: true, dryRun: true, due: people.size, wouldErase: batch });

    const results: Array<{ user_id: string; ok: boolean; files?: number; filesFailed?: number; error?: string }> = [];
    const emails = new Map<string, string>();   // the exit survey keeps the email address, the login no longer does
    try {
      const { data: fb } = await admin.from("cancellation_feedback").select("user_id, email").in("user_id", batch.map((b) => b.user_id));
      for (const r of fb || []) if (r.email) emails.set(r.user_id, String(r.email));
    } catch { /* the summary just shows the id */ }
    for (const person of batch) {
      try {
        const { data: files, error: pErr } = await admin.rpc("sw_account_storage_paths", { p_user: person.user_id });
        if (pErr) throw new Error("files: " + pErr.message);

        const { error: dErr } = await admin.auth.admin.deleteUser(person.user_id);   // hard delete; the database cleans up first
        if (dErr) {
          // The login may already be gone with data left behind: clean the data directly.
          if (/not.?found/i.test(dErr.message)) {
            const { error: rErr } = await admin.rpc("sw_purge_account_data", { p_user: person.user_id });
            if (rErr) throw new Error(rErr.message);
          } else throw new Error(dErr.message);
        }

        let failed = 0;
        const byBucket = new Map<string, string[]>();
        for (const f of (files || []) as Array<{ bucket: string; path: string }>) {
          if (!byBucket.has(f.bucket)) byBucket.set(f.bucket, []);
          byBucket.get(f.bucket)!.push(f.path);
        }
        for (const [bucket, paths] of byBucket) {
          for (let i = 0; i < paths.length; i += 100) {
            const { error: sErr } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
            if (sErr) { failed += paths.slice(i, i + 100).length; console.error("[purge] storage", bucket, sErr.message); }
          }
        }
        results.push({ user_id: person.user_id, ok: true, files: (files || []).length, filesFailed: failed });
      } catch (e) {
        console.error("[purge] failed for", person.user_id, (e as Error).message);
        results.push({ user_id: person.user_id, ok: false, error: (e as Error).message });
      }
    }
    const erased = results.filter((r) => r.ok).length;
    if (results.length > 0) await sendPurgeSummary(batch, results, emails);
    if (!privileged) return json(200, { ok: true, erased });
    return json(200, { ok: true, due: people.size, erased, results });
  } catch (e) {
    console.error("[purge]", (e as Error).message);
    return json(500, { error: "server_error" });
  }
});
