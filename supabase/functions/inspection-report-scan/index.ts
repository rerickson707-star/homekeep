// supabase/functions/inspection-report-scan/index.ts
// Reads a home inspection report (PDF or photo) and returns the findings and the
// equipment it lists, for the person to review. Nothing is saved here. The app shows
// every item and saves only what the person ticks.
//
// Rules this function keeps:
//  - The person is read from the login token. The browser never sends a user id or a plan.
//  - Plus and Pro only. The plan is the plan of the account that owns the home (invited people use the owner's plan).
//  - 5 reports per account per day, shared by everyone invited to its homes (public.inspection_scan_usage_bump).
//  - The report itself is not stored or logged here.
//  - Only what is printed in the report is returned. Nothing is estimated or invented.
//
// Run steadwell-inspection-scan.sql FIRST.
// Needs the secret ANTHROPIC_API_KEY (already set for the other scan functions).
// Deploy: npx supabase functions deploy inspection-report-scan --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DAILY_LIMIT = 5;
const MAX_BASE64 = 20 * 1024 * 1024; // about 15 MB of file
const MAX_FINDINGS = 40;
const MAX_ITEMS = 25;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-[a-z0-9-]+-rerickson707-star1\.vercel\.app$/,   // dev branch + per-deployment preview URLs
  /^http:\/\/localhost:\d+$/,
];
function corsFor(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const TASK_CATS = ["HVAC", "Plumbing", "Electrical", "Appliance", "Roofing", "Landscaping", "Structure", "Safety", "Other"];
const ASSET_CATS = ["HVAC", "Appliance", "Roofing", "Plumbing", "Electrical", "Structure", "Safety", "Landscaping", "Outdoor", "Other"];
const SEVERITIES = ["safety", "major", "repair", "maintenance", "monitor"];
const CONDITIONS = ["Good", "Fair", "Needs Attention", "Failed"];

const PROMPT = `You are reading a U.S. home inspection report for one house.

Return ONLY a JSON object with this shape:
{
  "is_inspection_report": true or false,
  "inspector_company": name of the inspection company or inspector as printed, or null,
  "inspection_date": "YYYY-MM-DD" or null,
  "property_address": the address the report is for, as printed, or null,
  "findings": [
    {
      "title": short plain title, 80 characters or fewer, for example "Water heater has no drain pan",
      "system": one of ["HVAC","Plumbing","Electrical","Appliance","Roofing","Landscaping","Structure","Safety","Other"],
      "severity": one of ["safety","major","repair","maintenance","monitor"],
      "detail": one or two plain sentences saying what the inspector found and where, 300 characters or fewer,
      "recommended_action": what the report recommends doing (for example "Have a licensed electrician evaluate and repair"), 200 characters or fewer, or null if the report gives none,
      "related_item": the name of the equipment this finding is about, matching an entry in "items" when there is one (for example "Water heater"), or null,
      "page": page number in the PDF where it appears, or null
    }
  ],
  "items": [
    {
      "item": short equipment name, for example "Water heater", "Furnace", "Roof covering", "Dishwasher",
      "category": one of ["HVAC","Appliance","Roofing","Plumbing","Electrical","Structure","Safety","Landscaping","Outdoor","Other"],
      "brand": brand as printed, or null,
      "model": model number as printed, or null,
      "serial_number": serial number as printed, or null,
      "year_made": 4-digit year of manufacture or installation if the report states it, or null,
      "age_years": approximate age in years if the report states it (for example "approximately 12 years old"), or null,
      "condition": one of ["Good","Fair","Needs Attention","Failed"], based only on the inspector's wording for that item (functional / satisfactory = Good, marginal / worn = Fair, repair or replacement recommended = Needs Attention, not working = Failed), or null if the report does not say
    }
  ],
  "uncertain": [ names of top-level fields you could not read clearly ]
}

Rules:
- Use only what is printed in the report. If a value is not shown, use null. Never guess, calculate, or add advice of your own. Do not estimate costs.
- "severity": safety = hazard to people or a safety defect; major = major defect or costly failure expected, or a system near the end of its life; repair = needs repair but not urgent; maintenance = routine upkeep or minor items; monitor = watch it over time.
- "findings" are defects and recommendations only. Leave out items marked satisfactory, general descriptions, limitations, disclaimers and photos. Give at most ${MAX_FINDINGS}, most important first (safety, then major, then the rest).
- "items" are the main equipment and systems the report identifies that a homeowner would track: water heater, HVAC units, roof, major appliances, electrical panel, garage door opener, well pump, septic, and similar. Give at most ${MAX_ITEMS}. Skip trivial fixtures.
- Plain text only, no markdown.
- If the document is not a home inspection report, return {"is_inspection_report": false} and nothing else.

Return only the JSON. No explanation.`;

const dateOk = (v: unknown): string | null => {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};
const txt = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, max);
  return s && s.toLowerCase() !== "null" ? s : null;
};
const oneOf = (v: unknown, list: string[], fallback: string | null): string | null => {
  const s = String(v ?? "").trim().toLowerCase();
  const hit = list.find((x) => x.toLowerCase() === s);
  return hit ?? fallback;
};

function clean(raw: Record<string, unknown>) {
  const findings: Record<string, unknown>[] = [];
  if (Array.isArray(raw.findings)) {
    for (const f of raw.findings.slice(0, MAX_FINDINGS)) {
      const o = (f ?? {}) as Record<string, unknown>;
      const title = txt(o.title, 80);
      if (!title) continue;
      const page = Math.round(Number(o.page));
      findings.push({
        title,
        system: oneOf(o.system, TASK_CATS, "Other"),
        severity: oneOf(o.severity, SEVERITIES, "repair"),
        detail: txt(o.detail, 300),
        recommended_action: txt(o.recommended_action, 200),
        related_item: txt(o.related_item, 60),
        page: Number.isFinite(page) && page > 0 && page < 1000 ? page : null,
      });
    }
  }
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.items)) {
    for (const it of raw.items.slice(0, MAX_ITEMS)) {
      const o = (it ?? {}) as Record<string, unknown>;
      const item = txt(o.item, 60);
      if (!item || seen.has(item.toLowerCase())) continue;
      seen.add(item.toLowerCase());
      // A missing value must stay missing. Number(null) is 0, which used to turn "no age in the report" into "less than a year old".
      const whole = (v: unknown) => (v === null || v === undefined || v === "" || typeof v === "boolean" ? NaN : Math.round(Number(v)));
      const ym = whole(o.year_made);
      const age = whole(o.age_years);
      items.push({
        item,
        category: oneOf(o.category, ASSET_CATS, "Other"),
        brand: txt(o.brand, 60),
        model: txt(o.model, 60),
        serial_number: txt(o.serial_number, 60),
        year_made: Number.isFinite(ym) && ym >= 1900 && ym <= new Date().getUTCFullYear() + 1 ? ym : null,
        age_years: Number.isFinite(age) && age >= 1 && age <= 100 ? age : null,
        condition: oneOf(o.condition, CONDITIONS, null),
      });
    }
  }
  const uncertain = Array.isArray(raw.uncertain) ? raw.uncertain.map(String).slice(0, 10) : [];
  return {
    meta: {
      inspector_company: txt(raw.inspector_company, 100),
      inspection_date: dateOk(raw.inspection_date),
      property_address: txt(raw.property_address, 140),
    },
    findings, items, uncertain,
  };
}

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Who is asking: from the login token only.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return json(401, { error: "not_signed_in" });
  const userId = u.user.id;

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }

  // Whose account pays: the owner of the home being worked on. A person invited to a home
  // (Admin, Full access or Tasks & assets) uses that owner's plan and the owner's daily limit.
  // Without a home, or for their own home, it is the person's own account.
  const propertyId = typeof b?.propertyId === "string" && /^[0-9a-f-]{36}$/i.test(b.propertyId) ? b.propertyId : null;
  const { data: acct, error: aErr } = await admin.rpc("sw_account_for", { p_user: userId, p_email: String(u.user.email || ""), p_property: propertyId });
  if (aErr) { console.error("[inspection-report-scan] account lookup failed:", aErr.message); return json(500, { error: "scan_failed" }); }
  const a = Array.isArray(acct) ? acct[0] : acct;
  if (!a?.owner_id) return json(403, { error: "not_yours" });
  const accountId = String(a.owner_id);
  const plan = String(a.plan || "free");
  if (plan !== "plus" && plan !== "pro") return json(403, { error: "plan_required", code: "plan_required" });

  const fileBase64 = String(b?.fileBase64 ?? "");
  const mimeType = String(b?.mimeType ?? "");
  const okType = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
  if (!fileBase64 || !okType) return json(400, { error: "bad_request" });
  if (fileBase64.length > MAX_BASE64) return json(413, { error: "too_large" });
  if (!ANTHROPIC_KEY) { console.error("[inspection-report-scan] ANTHROPIC_API_KEY missing"); return json(500, { error: "scan_failed" }); }

  // Daily limit (counts attempts, so it also caps cost).
  const { data: allowed, error: uslErr } = await admin.rpc("inspection_scan_usage_bump", { p_user: accountId, p_limit: DAILY_LIMIT });
  if (uslErr) { console.error("[inspection-report-scan] usage bump failed:", uslErr.message); return json(500, { error: "scan_failed" }); }
  if (allowed === false) return json(429, { error: "limit_reached", code: "limit_reached" });

  try {
    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            mimeType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
              : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    if (!aiResp.ok) {
      console.error("[inspection-report-scan] AI status:", aiResp.status);
      // A 400 here is almost always a report that is too long for one read.
      return json(aiResp.status === 400 ? 422 : 502, { error: aiResp.status === 400 ? "too_long" : "scan_failed" });
    }
    const aiJson = await aiResp.json();
    if (aiJson?.stop_reason === "max_tokens") console.error("[inspection-report-scan] output hit max_tokens");
    const rawText = String(aiJson?.content?.[0]?.text || "");
    const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!parsed || typeof parsed !== "object") return json(502, { error: "unreadable" });
    if (parsed.is_inspection_report === false) return json(422, { error: "not_an_inspection_report" });

    const { meta, findings, items, uncertain } = clean(parsed);
    if (findings.length === 0 && items.length === 0) return json(422, { error: "nothing_found" });
    return json(200, { ok: true, meta, findings, items, uncertain });
  } catch (e) {
    console.error("[inspection-report-scan] error:", (e as Error)?.message);
    return json(500, { error: "scan_failed" });
  }
});