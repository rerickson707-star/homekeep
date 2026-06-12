// supabase/functions/asset-intelligence/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { brand, model, category, install_date, zip_code, tier } = await req.json();

    if (!brand && !model) {
      return new Response(JSON.stringify({ error: "brand or model required" }), { status: 400, headers: CORS });
    }

    const isPro  = tier === "pro";
    const isPlus = tier === "plus" || isPro;
    const age    = install_date
      ? Math.floor((Date.now() - new Date(install_date).getTime()) / (365.25 * 86400000))
      : null;

    const systemPrompt = `You are a home maintenance expert, appliance specialist, and product researcher.
Given an asset's details, return a comprehensive JSON object with accurate information.
Use your knowledge of manufacturer specifications, typical market prices, and maintenance best practices.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.`;

    const userPrompt = `Asset details:
- Brand: ${brand || "Unknown"}
- Model: ${model || "Unknown"}
- Category: ${category || "Unknown"}
- Install date: ${install_date || "Unknown"}${age !== null ? ` (${age} years old)` : ""}
- Zip code: ${zip_code || "Unknown"}
- User tier: ${tier}

Return a JSON object with ALL of these fields (use null if genuinely unknown):
{
  "item": <full descriptive asset name, e.g. "Carrier 3-Ton Central Air Conditioner">,
  "brand": <brand name, properly capitalized>,
  "model": <model number as provided or corrected if obvious typo>,
  "category": <most accurate category from: HVAC, Heating, Plumbing, Electrical, Appliances, Roof, Structure, Exterior, Pool, Solar, Generator, Other>,
  "lifespan_years": <typical lifespan as integer>,
  "years_remaining": <estimated years remaining based on age, or null>,
  "condition": <"Excellent" | "Good" | "Fair" | "Poor" based on age vs lifespan>,
  "warranty_years": <standard manufacturer warranty length in years as integer>,
  "warranty_expiry": <ISO date string YYYY-MM-DD if install_date provided, else null>,
  "manual_url": <most likely direct URL to official owner's manual PDF or manufacturer support page — use manufacturer domain, e.g. "https://www.carrier.com/residential/en/us/products/air-conditioners/..." — if genuinely unsure return null>,
  "om_manual_url": <URL specifically to the O&M (operation and maintenance) manual PDF if different from manual_url, else same as manual_url>,
  "support_url": <manufacturer support/product page URL>,
  "pm_schedule": [
    {
      "title": <specific task title>,
      "interval_months": <frequency as integer>,
      "description": <brief actionable description>,
      "diy": <true if homeowner can do it, false if needs contractor>,
      "priority": <"High" | "Medium" | "Low">
    }
  ],
  ${isPlus ? `"replacement_cost_low": <low end DIY/unit cost in USD as integer>,
  "replacement_cost_high": <high end DIY/unit cost in USD as integer>,
  "replacement_cost_note": <one sentence: what's included, e.g. "Unit cost only, does not include installation">,
  "similar_models": [<1-2 current comparable model numbers>],` : ''}
  ${isPro ? `"contractor_cost_low": <low end fully installed by contractor in USD>,
  "contractor_cost_high": <high end fully installed by contractor in USD>,
  "contractor_note": <brief note on cost drivers>,` : ''}
  "condition_assessment": <one sentence assessment based on age and typical lifespan>,
  "maintenance_tip": <one specific actionable tip for this brand/model or category>
}

For pm_schedule: provide 3-6 realistic tasks ordered by priority. Be specific to the brand/model where possible.
For costs: use current US market prices (${new Date().getFullYear()}). Be realistic and conservative.
For manual_url: try manufacturer domain + support/manuals path. Better to return null than a broken link.
For condition: calculate based on age/lifespan ratio — under 33% = Excellent, 33-66% = Good, 66-90% = Fair, over 90% = Poor.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error: ${err}`);
    }

    const aiData = await response.json();
    const text = aiData.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let result;
    try { result = JSON.parse(clean); }
    catch { throw new Error("Failed to parse AI response as JSON"); }

    return new Response(JSON.stringify({ ok: true, data: result }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Asset intelligence error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
