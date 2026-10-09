// supabase/functions/guide-preview/index.ts
// Email gate for the free buyer-guide previews.
//
// Three modes (POST JSON):
//   "request"  email + consent + stage  -> saves the lead, emails a link to the preview PDF, and
//                                          returns the same link so the page can show it at once
//   "details"  leadId + optional answers -> adds the optional answers (timeline, area, concerns, agent)
//   "waitlist" email + consent + state   -> saves a "tell me when my state is ready" row, no email sent
//
// Rules this function keeps:
//  - The browser sends only what the person typed. It never sends a plan, price, tier or user id.
//  - Which file a guide id maps to is decided HERE, not by the browser. Only the free preview files
//    can ever be signed by this function; the full paid PDFs are never touched.
//  - guide_leads and the "guides" bucket are private (no policies); only this function reads them.
//  - Re-submitting the same email does not re-send more than once every 10 minutes (cap of 10 sends).
//
// Keep GUIDES, CONSENT_TEXTS and OPT in step with src/guides-registry.js
// (node scripts/check-guides.mjs fails if they drift).
//
// Run steadwell-guide-leads.sql FIRST, then upload the two preview PDFs to the "guides" bucket
// (florida/florida-state-2026-preview.pdf and florida/pinellas-county-2026-preview.pdf).
// Deploy: npx supabase functions deploy guide-preview
// (JWT verification stays ON: the site calls it with its normal anon key.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM           = "Steadwell <hello@trysteadwell.app>";
const SITE           = "https://www.trysteadwell.app";
const BUCKET         = "guides";
const LINK_SECONDS   = 7 * 24 * 3600;
const COOLDOWN_MS    = 10 * 60 * 1000;
const MAX_SENDS      = 10;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const GUIDES: Record<string, { name: string; path: string; preview: string }> = {
  "fl-state-2026":   { name: "The Florida First-Time Buyer Guide",    path: "/guides/florida",                 preview: "florida/florida-state-2026-preview.pdf" },
  "fl-pinellas-2026": { name: "Buying Your First Home in Pinellas County", path: "/guides/florida/pinellas-county", preview: "florida/pinellas-county-2026-preview.pdf" },
};

const CONSENT_TEXTS: Record<string, string> = {
  "guides-v1": "Email me the free preview and occasional home-buying tips from Steadwell. I can unsubscribe at any time.",
};

const OPT = {
  stage:    ["exploring", "preapproval", "touring", "offer", "contract", "closed"],
  timeline: ["0-3", "3-6", "6-12", "12+", "unsure"],
  concerns: ["downpayment", "insurance", "flood", "inspection", "taxes", "hoa", "closing", "agent"],
  agent:    ["yes", "no"],
};

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-git-[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function corsFor(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanEmail(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
function cleanText(v: unknown, max: number): string | null {
  const t = String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

function previewEmail(guideName: string, url: string): { subject: string; html: string; text: string } {
  const subject = `Your free preview: ${guideName}`;
  const text =
    `Here is your free preview of ${guideName}:\n\n${url}\n\n` +
    `The link works for 7 days. Open it on any device and save the PDF.\n\n` +
    `Reply to this email if you have a question.\n\nSteadwell, LLC, St. Petersburg, Florida`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1E2A25">` +
    `<p style="font-size:20px;font-weight:700;color:#234A3D;margin:0 0 16px">Steadwell</p>` +
    `<p style="font-size:16px;line-height:1.5;margin:0 0 20px">Here is your free preview of <strong>${esc(guideName)}</strong>.</p>` +
    `<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#C16140;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">Open the free preview</a></p>` +
    `<p style="font-size:14px;line-height:1.5;color:#52605A;margin:0 0 8px">The link works for 7 days. Open it on any device and save the PDF.</p>` +
    `<p style="font-size:14px;line-height:1.5;color:#52605A;margin:0 0 24px">Reply to this email if you have a question.</p>` +
    `<p style="font-size:12px;color:#7A8680;margin:0">Steadwell, LLC &middot; St. Petersburg, Florida</p></div>`;
  return { subject, html, text };
}

async function sendEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Steadwell/1.0" },
      body: JSON.stringify({ from: FROM, to: [to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: "hello@trysteadwell.app" }),
    });
    if (!res.ok) { console.error("[guide-preview] resend status", res.status); return false; }
    return true;
  } catch (e) {
    console.error("[guide-preview] resend error", (e as Error)?.message);
    return false;
  }
}

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (Number(req.headers.get("content-length") || "0") > 4000) return json(413, { error: "too_large" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  if (!b || typeof b !== "object") return json(400, { error: "bad_request" });

  // Hidden field only bots fill in: answer as if it worked, store nothing.
  if (b.website) return json(200, { ok: true });

  try {
    // ── details: optional answers added after the first step ─────────────────
    if (b.mode === "details") {
      const leadId = String(b.leadId ?? "");
      if (!UUID_RE.test(leadId)) return json(400, { error: "bad_request" });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.timeline !== undefined && b.timeline !== "") {
        if (!OPT.timeline.includes(String(b.timeline))) return json(400, { error: "bad_answer" });
        patch.timeline = String(b.timeline);
      }
      if (b.area !== undefined) patch.area = cleanText(b.area, 80);
      if (Array.isArray(b.concerns)) {
        const c = [...new Set(b.concerns.map(String))];
        if (c.length > 3 || c.some((x) => !OPT.concerns.includes(x))) return json(400, { error: "bad_answer" });
        patch.concerns = c;
      }
      if (b.hasAgent !== undefined && b.hasAgent !== "") {
        if (!OPT.agent.includes(String(b.hasAgent))) return json(400, { error: "bad_answer" });
        patch.has_agent = String(b.hasAgent);
      }
      await supabase.from("guide_leads").update(patch).eq("id", leadId);
      return json(200, { ok: true }); // same answer whether or not the id existed
    }

    // ── shared checks for request and waitlist ───────────────────────────────
    const email = cleanEmail(b.email);
    if (!email) return json(400, { error: "invalid_email" });
    const consentText = CONSENT_TEXTS[String(b.consentVersion ?? "")];
    if (b.consent !== true || !consentText) return json(400, { error: "consent_required" });
    const sourcePath = typeof b.sourcePath === "string" && b.sourcePath.startsWith("/guides") ? b.sourcePath.slice(0, 120) : null;

    // ── waitlist: someone in a state we have not written yet ─────────────────
    if (b.mode === "waitlist") {
      const area = cleanText(b.area, 40);
      if (!area) return json(400, { error: "bad_answer" });
      const { error } = await supabase.from("guide_leads").insert({
        email, guide_id: "waitlist", consent: true, consent_version: String(b.consentVersion), consent_text: consentText,
        area, source_path: sourcePath,
      });
      if (error && error.code !== "23505") { console.error("[guide-preview] waitlist insert", error.code); return json(500, { error: "server_error" }); }
      if (error) await supabase.from("guide_leads").update({ area, updated_at: new Date().toISOString() }).eq("email", email).eq("guide_id", "waitlist");
      return json(200, { ok: true });
    }

    // ── request: save the lead and deliver the preview ───────────────────────
    if (b.mode !== "request") return json(400, { error: "bad_request" });
    const guide = GUIDES[String(b.guideId ?? "")];
    if (!guide) return json(400, { error: "bad_request" });
    const stage = String(b.stage ?? "");
    if (!OPT.stage.includes(stage)) return json(400, { error: "stage_required" });

    let lead: { id: string; send_count: number; last_sent_at: string | null } | null = null;
    const ins = await supabase.from("guide_leads").insert({
      email, guide_id: String(b.guideId), consent: true, consent_version: String(b.consentVersion), consent_text: consentText,
      stage, source_path: sourcePath,
    }).select("id, send_count, last_sent_at").single();
    if (ins.error && ins.error.code === "23505") {
      const found = await supabase.from("guide_leads").update({ stage, updated_at: new Date().toISOString() })
        .eq("email", email).eq("guide_id", String(b.guideId)).select("id, send_count, last_sent_at").single();
      lead = found.data ?? null;
    } else if (ins.error) {
      console.error("[guide-preview] insert", ins.error.code);
      return json(500, { error: "server_error" });
    } else {
      lead = ins.data;
    }
    if (!lead) return json(500, { error: "server_error" });

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(guide.preview, LINK_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[guide-preview] sign failed", signed.error?.message);
      return json(500, { error: "preview_unavailable" });
    }
    const url = signed.data.signedUrl;

    const recent = lead.last_sent_at && Date.now() - new Date(lead.last_sent_at).getTime() < COOLDOWN_MS;
    let emailed = false;
    if (!recent && lead.send_count < MAX_SENDS) {
      emailed = await sendEmail(email, previewEmail(guide.name, url));
      if (emailed) {
        await supabase.from("guide_leads").update({ send_count: lead.send_count + 1, last_sent_at: new Date().toISOString() }).eq("id", lead.id);
      }
    }
    return json(200, { ok: true, leadId: lead.id, url, emailed, recentlySent: !!recent });
  } catch (e) {
    console.error("[guide-preview] unexpected", (e as Error)?.message);
    return json(500, { error: "server_error" });
  }
});
