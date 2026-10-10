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

// Prices shown in the preview email. scripts/check-guides.mjs fails if these differ from src/guides-registry.js.
const PRICE = { state: "14.99", county: "29.99", bundle: "37.99" };

const GUIDES: Record<string, {
  name: string; path: string; preview: string; cover: string; pages: number; price: string;
  points: string[]; pairNote: string;
}> = {
  "fl-state-2026": {
    name: "The Florida First-Time Buyer Guide", path: "/guides/florida", preview: "florida/florida-state-2026-preview.pdf",
    cover: "/guide-img/florida-cover.jpg", pages: 30, price: PRICE.state,
    points: ["Every inspection you may need, what it finds and what it costs", "Flood zones vs. evacuation zones, explained in plain English", "Down payment help, closing costs, insurance and property taxes, worked out"],
    pairNote: `Buying in Pinellas County? Add the Pinellas County guide and get both for $${PRICE.bundle}.`,
  },
  "fl-pinellas-2026": {
    name: "Buying Your First Home in Pinellas County", path: "/guides/florida/pinellas-county", preview: "florida/pinellas-county-2026-preview.pdf",
    cover: "/guide-img/pinellas-cover.jpg", pages: 23, price: PRICE.county,
    points: ["Pinellas flood zones vs. evacuation zones, and what storm surge does in each", "What to look out for after Helene and Milton, and which inspections to add", "Up to $75,000 in county down payment help, plus HFA, city and recovery programs"],
    pairNote: `Pair it with the Florida state guide and get both for $${PRICE.bundle}.`,
  },
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
  /^https:\/\/homekeep-[a-z0-9-]+-rerickson707-star1\.vercel\.app$/,   // dev branch + per-deployment preview URLs
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

function previewEmail(g: { name: string; path: string; cover: string; pages: number; price: string; points: string[]; pairNote: string }, url: string): { subject: string; html: string; text: string } {
  const subject = `Your free preview: ${g.name}`;
  const guideUrl = `${SITE}${g.path}#buy`;
  const signupUrl = `${SITE}/?action=signup`;
  const pine = "#234A3D", cream = "#F4EDDF", terra = "#C16140", ink = "#2A2723", soft = "#4A443D";
  const btn = (href: string, label: string, bg: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${bg}" style="border-radius:10px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a></td></tr></table>`;
  const points = g.points.map((p) => `<tr><td valign="top" style="padding:0 10px 8px 0;color:${pine};font-weight:700;font-size:16px;font-family:Arial,Helvetica,sans-serif">&#10003;</td><td style="padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:${ink}">${esc(p)}</td></tr>`).join("");
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${cream}">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${cream}">Your free preview of ${esc(g.name)} is ready to open.</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${cream}"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">` +
      // brand header
      `<tr><td bgcolor="${pine}" style="padding:22px 28px;border-radius:14px 14px 0 0"><a href="${SITE}" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:${cream};text-decoration:none;letter-spacing:-.3px">Steadwell</a><div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#C9D6CC;margin-top:4px">Your home, kept well.</div></td></tr>` +
      // preview
      `<tr><td bgcolor="#ffffff" style="padding:32px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:${ink}">` +
        `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;color:${pine};font-weight:700">Your free preview is ready</h1>` +
        `<p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:${soft}">Here are the first pages of <strong style="color:${ink}">${esc(g.name)}</strong>. These are real pages from the guide, not a summary.</p>` +
        btn(url, "Open the free preview (PDF)", terra) +
        `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;color:${soft}">The link works for 7 days. Open it on any device and save the PDF to keep it.</p>` +
      `</td></tr>` +
      // full guide
      `<tr><td bgcolor="#ffffff" style="padding:8px 28px 8px"><div style="border-top:1px solid #E6DECF;height:1px;line-height:1px;font-size:1px">&nbsp;</div></td></tr>` +
      `<tr><td bgcolor="#ffffff" style="padding:20px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:${ink}">` +
        `<h2 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:${pine}">Want the whole guide?</h2>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
          `<td width="112" valign="top" style="padding:0 18px 0 0"><a href="${esc(guideUrl)}"><img src="${SITE}${g.cover}" width="112" alt="Cover of ${esc(g.name)}" style="display:block;width:112px;height:auto;border-radius:4px;border:1px solid #E6DECF"></a></td>` +
          `<td valign="top"><p style="margin:0 0 6px;font-size:17px;font-weight:700;color:${ink}">${g.pages}-page PDF &middot; $${esc(g.price)} one-time</p><p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:${soft}">No subscription. Checkout is opening soon.</p></td>` +
        `</tr></table>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 14px">${points}</table>` +
        `<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:${soft}">${esc(g.pairNote)}</p>` +
        btn(guideUrl, "See the full guide", pine) +
      `</td></tr>` +
      // account
      `<tr><td bgcolor="#ffffff" style="padding:24px 28px 8px"><div style="border-top:1px solid #E6DECF;height:1px;line-height:1px;font-size:1px">&nbsp;</div></td></tr>` +
      `<tr><td bgcolor="#ffffff" style="padding:20px 28px 32px;font-family:Arial,Helvetica,sans-serif;color:${ink};border-radius:0 0 14px 14px">` +
        `<h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:${pine}">Keep your home on track after you close</h2>` +
        `<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${soft}">Steadwell keeps your maintenance schedule, warranties, insurance and home documents in one place. The free plan has no time limit and needs no credit card.</p>` +
        btn(signupUrl, "Create a free Steadwell account", terra) +
      `</td></tr>` +
      // footer
      `<tr><td style="padding:20px 8px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6B645B;text-align:center">` +
        `You are getting this because you asked for the free preview at trysteadwell.app. Reply to this email with &ldquo;unsubscribe&rdquo; and we will stop sending you guide emails.<br>` +
        `Steadwell, LLC &middot; St. Petersburg, Florida &middot; <a href="${SITE}/privacy" style="color:#6B645B">Privacy</a> &middot; <a href="${SITE}/terms" style="color:#6B645B">Terms</a><br>` +
        `Guides are general information, not legal, tax, insurance, financial or real estate advice.` +
      `</td></tr>` +
    `</table></td></tr></table></body></html>`;
  const text =
    `Your free preview is ready\n\n` +
    `Here are the first pages of ${g.name}. These are real pages from the guide.\n\n` +
    `Open the free preview (PDF): ${url}\n` +
    `The link works for 7 days. Open it on any device and save the PDF to keep it.\n\n` +
    `WANT THE WHOLE GUIDE?\n${g.pages}-page PDF, $${g.price} one-time, no subscription. Checkout is opening soon.\n` +
    g.points.map((x) => `- ${x}`).join("\n") + `\n${g.pairNote}\nSee the full guide: ${guideUrl}\n\n` +
    `KEEP YOUR HOME ON TRACK AFTER YOU CLOSE\nSteadwell keeps your maintenance schedule, warranties, insurance and home documents in one place. The free plan has no time limit and needs no credit card.\nCreate a free account: ${signupUrl}\n\n` +
    `You are getting this because you asked for the free preview at trysteadwell.app. Reply with "unsubscribe" and we will stop sending you guide emails.\n` +
    `Steadwell, LLC, St. Petersburg, Florida\nGuides are general information, not legal, tax, insurance, financial or real estate advice.`;
  return { subject, html, text };
}

async function sendEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "Steadwell/1.0" },
      body: JSON.stringify({ from: FROM, to: [to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: "hello@trysteadwell.app" }),
    });
    if (!res.ok) {
      // Resend explains the problem in its response body (for example an unverified sending domain or a bad key).
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      console.error("[guide-preview] resend status", res.status, detail);
      return false;
    }
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
      emailed = await sendEmail(email, previewEmail(guide, url));
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
