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
        max_tokens: 400,
        prompt: `You are reading a utility bill (electric, gas, water, internet, etc).

Return ONLY a JSON object:
{
  "utility_name": "name of the utility company (e.g. Duke Energy, Florida City Gas)",
  "utility_type": "electric | gas | water | internet | trash | sewer | other",
  "bill_date": "YYYY-MM-DD — use the statement date, due date, or billing period end date. Must be a full date.",
  "amount": total amount due as a number (not string),
  "usage": usage amount as a number if shown (kWh, therms, gallons, etc) or null,
  "usage_unit": "kWh | therms | gallons | Mcf | other unit shown" or null,
  "account_number": "account number if visible" or null,
  "notes": "billing period if shown, e.g. Apr 1 – Apr 30"
}

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
        prompt: `You are reading a home-related document. Extract all useful information.

Return ONLY a JSON object with whatever fields are relevant:
{
  "title": "document title or type",
  "date": "YYYY-MM-DD or null",
  "vendor": "company or person name if relevant",
  "amount": number or null,
  "item": "product or property if relevant",
  "notes": "key information from the document"
}

Return only the JSON. No markdown, no explanation.`,
      };
  }
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

    const { prompt, max_tokens } = getPrompt(scanType || "document");

    const isPdfRequest = mimeType === "application/pdf";

    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens,
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

    if (!aiResp.ok) {
      const err = await aiResp.text();
      return new Response(JSON.stringify({ ok: false, error: `AI error: ${err}` }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    const aiJson  = await aiResp.json();
    const rawText = aiJson.content?.[0]?.text || "";
    const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();

    let fields: Record<string, unknown>;
    try {
      fields = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return new Response(JSON.stringify({ ok: false, error: "Could not parse response", raw: rawText.slice(0, 200) }), {
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

    return new Response(JSON.stringify({ ok: true, fields }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
    });
  }
});
