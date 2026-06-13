// supabase/functions/ai-document-scan/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPTS: Record<string, string> = {
  receipt: `Extract expense information from this receipt. Return ONLY valid JSON, no explanation:
{
  "amount": number (total paid, no currency symbol),
  "vendor": string (business name),
  "date": string (YYYY-MM-DD or null),
  "category": string (one of: HVAC, Plumbing, Electrical, Appliances, Roofing, Landscaping, Structural, Safety, Other),
  "description": string (brief description of purchase or service)
}`,

  warranty: `Extract asset/warranty information from this warranty card or receipt. Return ONLY valid JSON:
{
  "item": string (product name),
  "category": string (one of: HVAC, Plumbing, Electrical, Appliances, Roofing, Landscaping, Structural, Safety, Other),
  "vendor": string (manufacturer or store),
  "model": string or null,
  "serial": string or null,
  "purchase_date": string (YYYY-MM-DD or null),
  "expiry_date": string (warranty expiry YYYY-MM-DD or null),
  "cost": number or null
}`,

  invoice: `Extract service information from this contractor invoice or work order. Return ONLY valid JSON:
{
  "description": string (work performed),
  "service_date": string (YYYY-MM-DD or null),
  "cost": number or null,
  "notes": string (technician, parts, findings — or null)
}`,

  insurance: `Extract insurance policy information from this document. Return ONLY valid JSON:
{
  "ins_company": string (insurance company name),
  "ins_policy_number": string or null,
  "ins_agent_name": string or null,
  "ins_agent_phone": string or null,
  "ins_premium": number (annual premium or null),
  "ins_renewal_date": string (YYYY-MM-DD or null)
}`,

  document: `Analyze this home document and extract key metadata. Return ONLY valid JSON:
{
  "name": string (descriptive document name e.g. "Home Inspection Report 2024"),
  "category": string (one of: legal, mortgage, inspection, insurance, permits, tax, contracts, other),
  "description": string (1-2 sentence summary of what this document contains),
  "expiry_date": string (YYYY-MM-DD if document has an expiry or renewal date, otherwise null)
}`,

  nameplate: `You are reading a photo of an equipment nameplate, data plate, or serial tag — the sticker or metal plate attached to an appliance or home system. Extract every piece of identifying information visible. Return ONLY valid JSON:
{
  "item": string (product name/description e.g. "Central Air Conditioner", "Gas Water Heater", "Dishwasher"),
  "brand": string (manufacturer name, properly capitalized e.g. "Carrier", "Rheem", "Bosch"),
  "model": string or null (model number exactly as shown, e.g. "24ACC636A003"),
  "serial_number": string or null (serial number exactly as shown),
  "category": string (one of: HVAC, Heating, Plumbing, Electrical, Appliances, Roofing, Structure, Exterior, Other),
  "manufacture_date": string (YYYY-MM-DD or YYYY-MM or YYYY if visible, otherwise null),
  "capacity": string or null (e.g. "3 Ton", "50 Gallon", "40,000 BTU" — any capacity/rating info),
  "voltage": string or null (electrical specs if shown, e.g. "240V / 30A"),
  "notes": string or null (any other useful info: efficiency rating, refrigerant type, fuel type, etc.)
}
If a field is not visible or legible, return null for that field. Model and serial numbers are usually labeled "Model No.", "Mod.", "Serial No.", "S/N", or similar.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType, scanType } = await req.json();

    if (!fileBase64 || !scanType) {
      return new Response(
        JSON.stringify({ error: "Missing fileBase64 or scanType" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const prompt = PROMPTS[scanType];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Unknown scanType: ${scanType}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Build content block — images use "image" type, PDFs use "document" type
    const isPdf = mimeType === "application/pdf";
    const fileContent = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image",    source: { type: "base64", media_type: mimeType || "image/jpeg", data: fileBase64 } };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [fileContent, { type: "text", text: prompt }],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return new Response(
        JSON.stringify({ error: "Anthropic API error", detail: err }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Extract JSON from response (strip any markdown fences)
    const jsonMatch = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response", raw: text }),
        { status: 500, headers: corsHeaders }
      );
    }

    const fields = JSON.parse(jsonMatch[0]);
    // Remove null values so they don't overwrite existing form data
    Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k]; });

    return new Response(
      JSON.stringify({ ok: true, fields }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
