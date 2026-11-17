import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

function getPrompt(scanType: string): { prompt: string; max_tokens: number } {
  switch (scanType) {

    case "barcode":
      return {
        max_tokens: 100,
        prompt: `Look at this image and find any barcode, UPC code, EAN code, or QR code.
Read the number encoded in the barcode carefully.

Return ONLY a JSON object with this exact format:
{"barcode": "THE_DIGITS_HERE"}

If you can see a barcode but cannot read it clearly, return:
{"barcode": "", "error": "barcode unclear"}

If there is no barcode in the image, return:
{"barcode": "", "error": "no barcode found"}

Return nothing else — no explanation, no markdown, just the JSON.`,
      };

    case "nameplate":
      return {
        max_tokens: 400,
        prompt: `You are reading an appliance or equipment nameplate label. Extract all visible information.

Return ONLY a JSON object:
{
  "item": "product name / description",
  "brand": "manufacturer brand name",
  "model": "model number",
  "serial_number": "serial number",
  "manufacture_date": "YYYY-MM-DD or YYYY-MM if day unknown, or null",
  "capacity": "capacity/size if shown (e.g. 40 gal, 3 ton)",
  "voltage": "voltage/wattage if shown",
  "notes": "any other useful specs from the label"
}

Return only the JSON. No markdown, no explanation.`,
      };

    case "utility_bill":
      return {
        max_tokens: 4000,
        prompt: `You are reading a utility bill (electric, gas, water, internet, etc). It may be a PDF, a screenshot or a phone photo, so read the numbers carefully. Today's date is {{TODAY}}.

Return ONLY a JSON object:
{
  "utility_name": "name of the utility company (e.g. Duke Energy, Florida City Gas)",
  "utility_type": "electric | gas | water | internet | trash | sewer | bundle | other — use bundle when ONE bill charges for two or more of water, sewer, trash and stormwater, as many city utility bills do",
  "bill_date": "YYYY-MM-DD — see the date rules below",
  "amount": number — see the amount rules below,
  "usage": number or null — see the usage rules below,
  "usage_unit": "kWh | therms | gallons | Mcf | other unit shown" or null,
  "account_number": "account number if visible" or null,
  "notes": "billing period if shown, e.g. Apr 1 – Apr 30",
  "line_items": {"water": number, "sewer": number, "trash": number, "stormwater": number, "other": number} or null,
  "uncertain": ["names of any fields above that you could not read clearly or had to guess"]
}

Date rules:
- bill_date is the date the bill was issued, labeled "Bill Date", "Statement Date", "Date Billed" or "Invoice Date".
- NEVER use the due date, the "pay by" date or the late-fee date.
- Use the last day of the billing period only if the bill shows no bill, statement or invoice date at all.
- A two-digit year is in the 2000s: 10/09/26 is 2026-10-09. Dates are month/day/year unless the bill clearly shows otherwise. Return a full date or null.

Amount rules:
- amount is what this bill charges for THIS billing period only. Use the line labeled "Total Current Charges", "Current Charges", "New Charges" or "Current Amount".
- Do NOT use "Total Amount Due", "Amount Due" or "Balance" when it includes a previous balance, balance forward, past-due amount, late fee or unapplied payment. Ignore payments and credits from earlier bills.
- If the bill shows a single total and no previous balance, use that total.
- Use a plain number with no currency symbol or commas.

Usage rules:
- usage is the TOTAL used during this billing period, in the unit the bill uses (kWh, therms, gallons, etc).
- Do NOT use a daily or per-day average, a "daily usage comparison", the "same period last year" figure, a 12-month history or a meter reading. If the bill shows only a daily average and no period total, use null.
- Water: use the total gallons for the period (for example the consumption column, 3,800 gallons). If the meter shows hundreds or thousands of gallons, convert it to gallons using the consumption shown. If there are several meters, add the drinking (potable) water meters and leave out reclaimed or irrigation-only meters.
- Electric: total kWh for the period. Gas: total therms (or Mcf) for the period.

Rules for line_items:
- Fill it only when this one bill charges for two or more of water, sewer (wastewater), trash (garbage, recycling, sanitation, solid waste) and stormwater (drainage). Otherwise use null.
- Use only the charges for THIS billing period. Ignore any previous balance, payments, credits and carried-over late fees.
- water = water service or usage charges. sewer = sewer or wastewater. trash = trash, garbage, recycling, sanitation or solid waste. stormwater = stormwater or drainage. other = every other charge on the bill, such as reclaimed water, taxes, franchise or public service fees, and other fees.
- Leave out a key when the bill has no such charge. Use plain dollar amounts as numbers, with no symbols.
- The values must add up to "amount". If you cannot make them add up, use null.

If a value is hidden, cut off or blurry, return null for it and list it in "uncertain". Do not guess.

Return only the JSON. No markdown, no explanation.`,
      };

    case "receipt":
      return {
        max_tokens: 400,
        prompt: `You are reading a purchase receipt or invoice. Extract the purchase information.

Return ONLY a JSON object:
{
  "vendor": "store or company name",
  "purchase_date": "YYYY-MM-DD or null",
  "amount": number or null,
  "item": "product name if visible",
  "notes": "any other relevant details"
}

Return only the JSON. No markdown, no explanation.`,
      };

    case "warranty":
      return {
        max_tokens: 500,
        prompt: `You are reading a warranty card, warranty document, or product registration card.

Return ONLY a JSON object:
{
  "item": "product name",
  "brand": "manufacturer brand",
  "model": "model number if shown",
  "serial_number": "serial number if shown",
  "purchase_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "warranty_years": number or null,
  "vendor": "store purchased from if shown",
  "amount": number or null,
  "notes": "warranty terms or coverage details"
}

Return only the JSON. No markdown, no explanation.`,
      };

    case "invoice":
      return {
        max_tokens: 500,
        prompt: `You are reading a contractor invoice, utility bill, or service receipt.

Return ONLY a JSON object:
{
  "vendor": "company or contractor name",
  "purchase_date": "YYYY-MM-DD or null",
  "amount": number or null,
  "description": "service or work description",
  "category": "e.g. HVAC, Plumbing, Electrical, Landscaping, Other",
  "notes": "any other relevant details like invoice number, work order"
}

Return only the JSON. No markdown, no explanation.`,
      };

    case "insurance":
      return {
        max_tokens: 700,
        prompt: `You are reading a homeowner insurance policy, declaration page, renewal notice, or insurance ID card. This may be a multi-page document — look across all pages for the requested fields.

Return ONLY a JSON object:
{
  "ins_company": "insurance company / carrier name",
  "ins_policy_number": "policy number",
  "ins_agent_name": "agent or broker name if listed",
  "ins_agent_phone": "agent phone number if listed",
  "ins_premium": number or null (annual premium in dollars, no symbols),
  "ins_deductible": number or null (standard/all-other-perils deductible in dollars),
  "ins_dwelling_coverage": number or null (Coverage A — dwelling),
  "ins_personal_property": number or null (Coverage C — personal property/contents),
  "ins_liability_coverage": number or null (Coverage E — personal liability),
  "ins_loss_of_use": number or null (Coverage D — loss of use/additional living expense),
  "ins_renewal_date": "YYYY-MM-DD or null (policy expiration/renewal date)",
  "ins_notes": "named exclusions, riders, endorsements, wind mitigation discounts, or other key details worth remembering"
}

If a field is not present in the document, return null for it rather than guessing. Distinguish between similarly-named coverages carefully — dwelling (structure) is different from personal property (contents) is different from liability.

Return only the JSON. No markdown, no explanation.`,
      };

    case "additional_policy":
      return {
        max_tokens: 500,
        prompt: `You are reading a supplemental insurance policy document — this could be flood (often NFIP), wind/hurricane, umbrella/excess liability, earthquake, a jewelry/valuables rider, or a home warranty contract. This may be a multi-page document — look across all pages for the requested fields.

Return ONLY a JSON object:
{
  "type": "one of: flood, wind, umbrella, earthquake, jewelry, home_warranty, other — pick the best match based on the document content",
  "company": "insurance company or underwriter name",
  "policy_number": "policy number",
  "premium": number or null (annual premium in dollars, no symbols),
  "coverage": number or null (the primary coverage/limit amount in dollars),
  "renewal_date": "YYYY-MM-DD or null (policy expiration/renewal date)",
  "notes": "deductible amount, agent name, named exclusions, or other key details worth remembering"
}

If a field is not present in the document, return null for it rather than guessing.

Return only the JSON. No markdown, no explanation.`,
      };

    case "document":
    default:
      return {
        max_tokens: 600,
        prompt: `You are reading a home-related document that a homeowner is filing in their document vault.

Return ONLY a JSON object:
{
  "name": "short plain name for the document, 60 characters or fewer, for example 'Property tax bill 2026', 'Home inspection report, Oct 2026' or 'Roof warranty, Acme Roofing'",
  "category": "one of: legal (deed, title, survey, closing documents, easements) | mortgage (loan documents, statements, refinance, HELOC) | inspection (home, pest, radon, mold, septic or pool inspection reports) | insurance (homeowners, flood, umbrella or other policies) | permits (building permits, certificates of occupancy, permitted work) | tax (property tax bills, assessments, payment records) | contracts (HOA documents, service contracts, home warranty plans) | other",
  "description": "one plain sentence saying what the document is and who it is from, 140 characters or fewer",
  "expiry_date": "YYYY-MM-DD" for a date the homeowner should be reminded about (policy renewal, warranty end, permit expiry, tax due date), or null if the document has none
}

Use only what is printed in the document. If something is not shown, use null. Plain text only.

Return only the JSON. No markdown, no explanation.`,
      };
  }
}

// ── Utility bills: validate what the AI returned before the app sees it ────────
// The split by service is only passed on when it really is a split (two or more services) and the
// parts add up to the bill total to the cent. Anything else is dropped, and split_status says why,
// so the app can tell the person to enter the split by hand instead of showing numbers that do not add up.
const UTILITY_TYPES = ["electric", "gas", "water", "internet", "trash", "sewer", "bundle", "other"];
const SPLIT_KEYS = ["water", "sewer", "trash", "stormwater", "other"];

// Drop values that cannot be right, so the form is left blank instead of filled with a wrong number.
function sanitizeUtilityBill(fields: Record<string, unknown>) {
  const dropped: string[] = [];
  // Bill date: a real calendar date, not in the future (a due date is the usual cause).
  const bd = String(fields.bill_date ?? "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bd);
  let okDate = false;
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    okDate = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
      && +m[1] >= 2000 && d.getTime() <= Date.now() + 3 * 86_400_000;
  }
  if (!okDate) { if (fields.bill_date != null && bd !== "") dropped.push("bill_date"); fields.bill_date = null; }
  // Amount: a positive number of a sensible size.
  const amt = Number(fields.amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt >= 100_000) { if (fields.amount != null) dropped.push("amount"); fields.amount = null; }
  else fields.amount = Math.round(amt * 100) / 100;
  // Usage: positive and finite.
  const use = Number(fields.usage);
  if (fields.usage == null || !Number.isFinite(use) || use <= 0 || use >= 100_000_000) { if (fields.usage != null) dropped.push("usage"); fields.usage = null; fields.usage_unit = fields.usage_unit ?? null; }
  else fields.usage = use;
  const unc = Array.isArray(fields.uncertain) ? (fields.uncertain as unknown[]).map(String).filter(Boolean) : [];
  fields.uncertain = Array.from(new Set([...unc, ...dropped]));
}

function cleanUtilityBill(fields: Record<string, unknown>) {
  sanitizeUtilityBill(fields);
  const raw = fields.line_items;
  delete fields.line_items;
  let status = "none";
  if (raw && typeof raw === "object") {
    const clean: Record<string, number> = {};
    for (const k of SPLIT_KEYS) {
      const n = Number((raw as Record<string, unknown>)[k]);
      if (Number.isFinite(n) && n > 0 && n < 1_000_000) clean[k] = Math.round(n * 100) / 100;
    }
    const sum = Math.round(Object.values(clean).reduce((a, b) => a + b, 0) * 100) / 100;
    const total = Number(fields.amount);
    if (Object.keys(clean).length >= 2 && Number.isFinite(total) && total > 0) {
      if (Math.abs(sum - total) <= 0.011) { fields.line_items = clean; fields.utility_type = "bundle"; status = "ok"; }
      else status = "mismatch";
    }
  }
  fields.split_status = status;
  if (!UTILITY_TYPES.includes(String(fields.utility_type))) fields.utility_type = "other";
}

// ── Documents: the form fills name, category, description and expiry date, so return exactly those ─────────
const DOC_CATEGORY_IDS = ["legal", "mortgage", "inspection", "insurance", "permits", "tax", "contracts", "other"];
function cleanDocument(fields: Record<string, unknown>) {
  const str = (v: unknown, n: number) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t && t.toLowerCase() !== "null" ? t.slice(0, n) : ""; };
  const date = (v: unknown) => { const t = String(v ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return ""; const d = new Date(t + "T00:00:00Z"); return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? "" : t; };
  const cat = String(fields.category ?? "").toLowerCase().trim();
  const out = {
    name: str(fields.name ?? fields.title, 60),
    category: DOC_CATEGORY_IDS.includes(cat) ? cat : "",
    description: str(fields.description ?? fields.notes, 140),
    expiry_date: date(fields.expiry_date),
  };
  for (const k of Object.keys(fields)) delete fields[k];
  Object.assign(fields, out);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.text();
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Body required" }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
      });
    }

    const { fileBase64, mimeType, scanType } = JSON.parse(body);

    if (!fileBase64) {
      return new Response(JSON.stringify({ ok: false, error: "fileBase64 required" }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
      });
    }

    // Server-side PDF page guard — defense in depth behind the client-side check.
    // Only blocks when confident; uncertain counts pass through to Anthropic's own limit check.
    if (mimeType === "application/pdf") {
      try {
        const pdfBytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
        let pdfStr = "";
        const chunk = 65536;
        for (let i = 0; i < pdfBytes.length; i += chunk) {
          pdfStr += String.fromCharCode.apply(null, pdfBytes.subarray(i, Math.min(i + chunk, pdfBytes.length)));
        }
        const matches = [...pdfStr.matchAll(/\/Type\s*\/Pages[^>]{0,200}?\/Count\s+(\d+)/g)];
        const counts = matches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n) && n > 0);
        const pageCount = counts.length > 0 ? Math.max(...counts) : null;
        if (pageCount !== null && pageCount > 100) {
          return new Response(JSON.stringify({
            ok: false,
            error: `This document has ${pageCount} pages, which exceeds the 100-page scanning limit. Try uploading just the declarations page or relevant section instead.`,
          }), { headers: { ...CORS, "Content-Type": "application/json" }, status: 400 });
        }
      } catch {
        // If page count can't be determined, allow through — Anthropic's API will reject if truly oversized
      }
    }

    const { prompt: rawPrompt, max_tokens } = getPrompt(scanType || "document");
    const prompt = rawPrompt.replace("{{TODAY}}", new Date().toISOString().slice(0, 10));
    // Bills are the hardest thing to read (small print, photos, city bills with many lines), so they use the stronger model.
    const model = scanType === "utility_bill" ? "claude-sonnet-5-5" : "claude-haiku-4-5";

    const isPdfRequest = mimeType === "application/pdf";

    const callModel = (useModel: string) => fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: useModel,
        max_tokens,
        // Sonnet 5.5 thinks by default. Keep it short for reading a bill; the thinking tokens count toward max_tokens.
        ...(useModel === "claude-sonnet-5-5" ? { output_config: { effort: "low" } } : {}),
        messages: [{
          role: "user",
          content: [
            isPdfRequest
              ? {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: fileBase64,
                  },
                }
              : {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType || "image/jpeg",
                    data: fileBase64,
                  },
                },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    // Take the text blocks by type, not by position: newer models can open with a thinking block.
    type Block = { type?: string; text?: unknown };
    const textOf = (j: { content?: unknown }) => {
      const bl: Block[] = Array.isArray(j?.content) ? (j.content as Block[]) : [];
      return bl.filter(b => b && b.type === "text" && typeof b.text === "string").map(b => String(b.text)).join("\n");
    };

    let aiResp = await callModel(model);
    let aiJson: { content?: unknown; stop_reason?: string } | null = null;
    let rawText = "";
    if (aiResp.ok) { aiJson = await aiResp.json(); rawText = textOf(aiJson!); }
    // Safety net: if the stronger model errors or returns no text, retry once on the model that was in use before.
    if ((!aiResp.ok || !rawText.trim()) && model !== "claude-haiku-4-5") {
      console.error("ai-document-scan: fallback to haiku", { status: aiResp.status, stop_reason: aiJson?.stop_reason ?? null });
      aiResp = await callModel("claude-haiku-4-5");
      aiJson = null; rawText = "";
      if (aiResp.ok) { aiJson = await aiResp.json(); rawText = textOf(aiJson!); }
    }

    if (!aiResp.ok || !aiJson) {
      const err = await aiResp.text();
      return new Response(JSON.stringify({ ok: false, error: `AI error: ${err}` }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    const blocks: Block[] = Array.isArray(aiJson.content) ? (aiJson.content as Block[]) : [];
    const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();

    let fields: Record<string, unknown>;
    try {
      fields = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return new Response(JSON.stringify({ ok: false, error: "Could not parse response", raw: rawText.slice(0, 200), stop_reason: aiJson.stop_reason ?? null, block_types: blocks.map(b => b?.type ?? "?") }), {
          headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
        });
      }
      try { fields = JSON.parse(match[0]); }
      catch {
        return new Response(JSON.stringify({ ok: false, error: "Malformed response" }), {
          headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
        });
      }
    }

    if (scanType === "utility_bill") cleanUtilityBill(fields);
    if (scanType === "document") cleanDocument(fields);

    return new Response(JSON.stringify({ ok: true, fields }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
    });
  }
});
