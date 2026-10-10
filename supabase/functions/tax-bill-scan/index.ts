// supabase/functions/tax-bill-scan/index.ts
// Reads a property tax bill (photo or PDF) and returns the numbers for the person to review.
// Nothing is saved here. The app shows every value and saves only after the person confirms.
//
// Rules this function keeps:
//  - The person is read from the login token. The browser never sends a user id or a plan.
//  - Plus and Pro only. The plan is read from the oldest home the person owns (same rule as the rest of the app).
//  - 15 scans per person per day (public.tax_scan_usage_bump).
//  - The bill itself is not stored or logged here.
//
// Run steadwell-fixed-costs.sql FIRST.
// Needs the secret ANTHROPIC_API_KEY (already set for ai-document-scan).
// Deploy: npx supabase functions deploy tax-bill-scan --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DAILY_LIMIT = 15;
const MAX_BASE64 = 20 * 1024 * 1024; // about 15 MB of file

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

const PROMPT = `You are reading a U.S. property tax bill (also called a tax notice, tax statement or tax receipt) for one parcel and one tax year.

Return ONLY a JSON object with this shape:
{
  "is_tax_bill": true or false,
  "tax_year": 4-digit year the bill is for (for example 2026), or null,
  "total": the FULL annual amount of tax and assessments for the year, as a number. Not the discounted amount, not one installment, not a past-due balance. null if unclear,
  "assessed_value": the value taxes are based on before exemptions (assessed, taxable-before-exemptions or "assessed/capped" value; if the bill shows both a market/just value and an assessed value, use the assessed value), number or null,
  "exemptions": total value of exemptions or reductions (homestead, senior, veteran, etc), as a dollar value, number or null,
  "taxable_value": the value the tax rate is applied to after exemptions, number or null,
  "due_date": "YYYY-MM-DD" of the main or first payment due date, or null,
  "installments": short text if the bill is paid in installments or has several due dates (for example "Two payments: Nov 1 and Feb 1"), else null,
  "discount_pct": percent discount for early payment as a number (for example 4), or null if none is offered,
  "discount_by": "YYYY-MM-DD" deadline for that early-payment discount, or null,
  "components": [ {"name": "taxing authority or line, for example County", "mills": rate in mills as a number or null, "amount": dollars for this line as a number } ],
  "uncertain": [ names of fields above that you could not read clearly or had to guess ]
}

Rules:
- Use only what is printed on the document. If a value is not shown, use null. Never guess or calculate a value that is not printed.
- Plain numbers only, no dollar signs or commas.
- "components" lists each taxing authority or charge for the year (county, school district, city, special districts, fire, non-ad valorem assessments, and so on). Their amounts should add up to "total". If the bill does not itemize, use an empty array.
- Leave out previous balances, payments received, late fees and interest.
- If the document is not a property tax bill, return {"is_tax_bill": false} and nothing else.

Return only the JSON. No markdown, no explanation.`;

const FIELD_KEYS = ["tax_year", "total", "assessed_value", "exemptions", "taxable_value", "due_date", "discount_pct", "discount_by", "components"];

const num = (v: unknown, max = 1e9): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : Number(v);
  return Number.isFinite(n) && n >= 0 && n < max ? Math.round(n * 100) / 100 : null;
};
const dateOk = (v: unknown): string | null => {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

// Validate everything the AI returned before the app sees it.
function clean(raw: Record<string, unknown>) {
  const year = Math.round(Number(raw.tax_year));
  const f: Record<string, unknown> = {
    tax_year: Number.isFinite(year) && year >= 1990 && year <= 2100 ? year : null,
    total: num(raw.total, 1e7),
    assessed_value: num(raw.assessed_value, 1e10),
    exemptions: num(raw.exemptions, 1e10),
    taxable_value: num(raw.taxable_value, 1e10),
    due_date: dateOk(raw.due_date),
    installments: typeof raw.installments === "string" ? raw.installments.slice(0, 160) : null,
    discount_pct: null as number | null,
    discount_by: dateOk(raw.discount_by),
    components: [] as { name: string; mills: number | null; amount: number }[],
  };
  const dp = num(raw.discount_pct, 50);
  f.discount_pct = dp && dp > 0 ? dp : null;
  if (!f.discount_pct) f.discount_by = null;

  const comps: { name: string; mills: number | null; amount: number }[] = [];
  if (Array.isArray(raw.components)) {
    for (const c of raw.components.slice(0, 20)) {
      const o = (c ?? {}) as Record<string, unknown>;
      const amount = num(o.amount, 1e7);
      const name = String(o.name ?? "").trim().slice(0, 80);
      if (amount === null || !name) continue;
      comps.push({ name, mills: num(o.mills, 1000), amount });
    }
  }
  f.components = comps;

  // Cross-checks the app shows to the person.
  const checks: Record<string, string> = {};
  const total = f.total as number | null;
  if (comps.length > 0 && total !== null) {
    const sum = Math.round(comps.reduce((a, c) => a + c.amount, 0) * 100) / 100;
    checks.components = Math.abs(sum - total) <= 1.0 ? "ok" : "mismatch";
  }
  const av = f.assessed_value as number | null, ex = f.exemptions as number | null, tv = f.taxable_value as number | null;
  if (av !== null && tv !== null) {
    const expect = av - (ex ?? 0);
    checks.taxable = Math.abs(expect - tv) <= 1 ? "ok" : "mismatch";
  }

  const uncertain = Array.isArray(raw.uncertain)
    ? raw.uncertain.map(String).filter((k) => FIELD_KEYS.includes(k))
    : [];
  return { fields: f, checks, uncertain };
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

  // Which plan: the oldest home this person owns.
  const { data: prof, error: pErr } = await admin
    .from("profiles").select("plan").eq("user_id", userId)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1);
  if (pErr) { console.error("[tax-bill-scan] plan lookup failed:", pErr.message); return json(500, { error: "scan_failed" }); }
  const plan = String(prof?.[0]?.plan || "free");
  if (plan !== "plus" && plan !== "pro") return json(403, { error: "plan_required", code: "plan_required" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const fileBase64 = String(b?.fileBase64 ?? "");
  const mimeType = String(b?.mimeType ?? "");
  const okType = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
  if (!fileBase64 || !okType) return json(400, { error: "bad_request" });
  if (fileBase64.length > MAX_BASE64) return json(413, { error: "too_large" });
  if (!ANTHROPIC_KEY) { console.error("[tax-bill-scan] ANTHROPIC_API_KEY missing"); return json(500, { error: "scan_failed" }); }

  // Daily limit (counts attempts, so it also caps cost).
  const { data: allowed, error: uslErr } = await admin.rpc("tax_scan_usage_bump", { p_user: userId, p_limit: DAILY_LIMIT });
  if (uslErr) { console.error("[tax-bill-scan] usage bump failed:", uslErr.message); return json(500, { error: "scan_failed" }); }
  if (allowed === false) return json(429, { error: "limit_reached", code: "limit_reached" });

  try {
    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
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
      console.error("[tax-bill-scan] AI status:", aiResp.status);
      return json(502, { error: "scan_failed" });
    }
    const aiJson = await aiResp.json();
    const rawText = String(aiJson?.content?.[0]?.text || "");
    const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!parsed || typeof parsed !== "object") return json(502, { error: "unreadable" });
    if (parsed.is_tax_bill === false) return json(422, { error: "not_a_tax_bill" });

    const { fields, checks, uncertain } = clean(parsed);
    if (fields.total === null) return json(422, { error: "no_total" });
    return json(200, { ok: true, fields, checks, uncertain });
  } catch (e) {
    console.error("[tax-bill-scan] error:", (e as Error)?.message);
    return json(500, { error: "scan_failed" });
  }
});
