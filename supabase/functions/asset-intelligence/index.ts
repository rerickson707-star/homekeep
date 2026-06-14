import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ANTHROPIC_API  = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TAVILY_KEY     = Deno.env.get("TAVILY_API_KEY") || "";
const TAVILY_SEARCH  = "https://api.tavily.com/search";
const TAVILY_EXTRACT = "https://api.tavily.com/extract";
const UPC_API        = "https://api.upcitemdb.com/prod/trial/lookup";

// ── STEP 1: UPC barcode lookup (keyless, free 100/day) ────────────────────
async function lookupUPC(upc: string): Promise<Record<string,string> | null> {
  try {
    const res = await fetch(`${UPC_API}?upc=${encodeURIComponent(upc.trim())}`);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.items?.[0];
    if (!item) return null;
    return {
      title:       item.title       || "",
      brand:       item.brand       || "",
      model:       item.model       || "",
      description: item.description || "",
      category:    item.category    || "",
      image:       item.images?.[0] || "",
    };
  } catch { return null; }
}

// ── STEP 2: Tavily search for real manufacturer docs ──────────────────────
async function tavilySearch(brand: string, model: string, item: string): Promise<{url:string, content:string}[]> {
  if (!TAVILY_KEY) return [];
  const brandClean = brand.toLowerCase().replace(/\s+/g, "");
  // Build a targeted search — prefer manufacturer support & manual pages
  const query = `"${model}" ${brand} owner manual maintenance warranty site:${brandClean}.com OR filetype:pdf OR site:manualslib.com`;
  try {
    const res = await fetch(TAVILY_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_KEY}` },
      body: JSON.stringify({
        query,
        max_results: 5,
        search_depth: "advanced",
        include_raw_content: false,
        include_domains: [
          `${brandClean}.com`,
          `support.${brandClean}.com`,
          "manualslib.com",
          "manualshark.com",
          "manuals.plus",
          "manua.ls",
        ],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: Record<string,string>) => ({
      url:     r.url     || "",
      content: r.content || r.raw_content || "",
    })).filter((r: {url:string,content:string}) => r.url);
  } catch { return []; }
}

// ── STEP 3: Tavily extract — pull full content from best URL ──────────────
async function tavilyExtract(urls: string[]): Promise<string> {
  if (!TAVILY_KEY || !urls.length) return "";
  // Take top 2 most promising URLs
  const targets = urls
    .filter(u => u.includes("manual") || u.includes("support") || u.includes("owner") || u.includes("guide") || u.includes("maintenance"))
    .slice(0, 2);
  const extractUrls = (targets.length ? targets : urls.slice(0, 2));
  try {
    const res = await fetch(TAVILY_EXTRACT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_KEY}` },
      body: JSON.stringify({ urls: extractUrls }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    return (json.results || [])
      .map((r: Record<string,string>) => `SOURCE: ${r.url}\n${r.raw_content || r.content || ""}`)
      .join("\n\n---\n\n")
      .slice(0, 8000); // cap to keep prompt manageable
  } catch { return ""; }
}

// ── Parse JSON safely from AI response ───────────────────────────────────
function parseAIJson(text: string): Record<string,unknown> | null {
  const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.text();
    if (!body) return new Response(JSON.stringify({ ok: false, error: "Body required" }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
    });

    const { brand, model, item, upc, category, install_date, tier, barcode_search } = JSON.parse(body);
    const isPro  = tier === "pro";
    const isPlus = tier === "plus" || isPro;

    // ── Barcode-only search: UPCitemdb missed it, try Tavily web search ───
    if (barcode_search && upc) {
      let productName = "", productBrand = "", productModel = "";
      try {
        // Search the raw UPC — retail sites index by UPC so this finds exact matches
        const query = `${upc}`;
        const searchRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_KEY}` },
          body: JSON.stringify({
            query,
            max_results: 5,
            search_depth: "advanced",   // deeper = more content per result
            include_domains: ["amazon.com","homedepot.com","walmart.com","bestbuy.com","target.com","lowes.com","amazon.ca","build.com"],
          }),
        });
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const results = searchJson.results || [];
          if (results.length > 0) {
            // Combine all result titles and content for better extraction
            const combined = results
              .map((r: Record<string,string>) => `LISTING: ${r.title || ""}\nDETAILS: ${r.content || ""}`)
              .join("\n\n")
              .slice(0, 1500);

            const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01" },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 200,
                messages: [{
                  role: "user",
                  content: `These are retail product listings for barcode/UPC ${upc}.
Extract the exact product name, brand name, and model number.

The model number is critical — it is usually:
- A short alphanumeric code like "CFN601", "WH49D3S", "WSS20D6PAS00", "AF160"
- Often appears in the listing title itself or in the product details
- NOT the UPC/barcode number (${upc})
- NOT a price, SKU, or ASIN

Return ONLY valid JSON:
{"item": "full product name", "brand": "brand name", "model": "model number — alphanumeric code only, empty string if not found"}

Listings:
${combined}`,
                }],
              }),
            });
            if (aiResp.ok) {
              const aiJson = await aiResp.json();
              const raw = (aiJson.content?.[0]?.text || "").replace(/```json\n?|```\n?/g,"").trim();
              try {
                const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
                productName  = parsed.item  || results[0]?.title || "";
                productBrand = parsed.brand || "";
                // Validate model — must be alphanumeric, not the UPC itself
                const m = (parsed.model || "").trim();
                productModel = (m && m !== upc && m.length >= 3 && m.length <= 30) ? m : "";
              } catch { productName = results[0]?.title || ""; }
            }
          }
        }
      } catch { /* return empty */ }
      return new Response(JSON.stringify({
        ok: true,
        data: { item:productName, brand:productBrand, model:productModel, upc_verified:false, docs_found:!!productName, confidence: productModel ? "high" : "medium" },
      }), { headers:{ ...CORS,"Content-Type":"application/json" } });
    }

    // ── Phase 1: UPC lookup if barcode was scanned ────────────────────────
    let upcData: Record<string,string> | null = null;
    if (upc && upc.trim().length >= 8) {
      upcData = await lookupUPC(upc);
    }

    // Resolved product identity — UPC wins over manual entry
    const resolvedBrand = upcData?.brand || brand || "";
    const resolvedModel = upcData?.model || model || "";
    const resolvedItem  = upcData?.title || item  || "";

    if (!resolvedBrand && !resolvedModel && !resolvedItem) {
      return new Response(JSON.stringify({ ok: false, error: "brand, model, item, or UPC required" }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
      });
    }

    // ── Phase 2: Tavily search for real manufacturer docs ─────────────────
    let manufacturerContent = "";
    let sourceUrls: string[] = [];

    if (resolvedModel && resolvedBrand) {
      const searchResults = await tavilySearch(resolvedBrand, resolvedModel, resolvedItem);
      sourceUrls = searchResults.map(r => r.url);
      // Use search snippets + extract top pages for full content
      const snippets = searchResults.map(r => `[${r.url}]\n${r.content}`).join("\n\n");
      const extracted = await tavilyExtract(sourceUrls);
      manufacturerContent = [snippets, extracted].filter(Boolean).join("\n\n---\n\n").slice(0, 10000);
    }

    // ── Phase 3: Claude reads real docs and extracts structured data ───────
    const upcSection = upcData ? `
UPC DATABASE RESULT (verified product identity):
- Product: ${upcData.title}
- Brand: ${upcData.brand}
- Model: ${upcData.model}
- Description: ${upcData.description}
- Category: ${upcData.category}
` : "";

    const docsSection = manufacturerContent ? `
MANUFACTURER DOCUMENTATION (from real web sources — use this as primary source):
${manufacturerContent}
` : "";

    const fallbackSection = !manufacturerContent ? `
No manufacturer documentation was found. Generate reasonable estimates based on your knowledge
of this product type and brand. Mark confidence as "medium" or "low".
` : "";

    const prompt = `You are a home appliance expert. Extract maintenance data for a home management app.

PRODUCT BEING LOOKED UP:
- Brand: ${resolvedBrand || "Unknown"}
- Model: ${resolvedModel || "Unknown"}  
- Name: ${resolvedItem || "Unknown"}
- Category hint: ${category || "Unknown"}
- Install date: ${install_date || "Unknown"}
${upcSection}${docsSection}${fallbackSection}

INSTRUCTIONS:
${manufacturerContent
  ? `The manufacturer documentation above is your PRIMARY source. Extract the actual:
     - Maintenance schedule (exact tasks from the owner's manual)
     - Warranty terms (exact duration from the manual/warranty card)
     - Manual URL (the actual URL from the sources above)
     - Support page URL (the actual URL from the sources above)
     Base your answer on what the documents actually say, not assumptions.`
  : `No real documentation was found. Use your training knowledge about this specific
     product/brand to provide accurate maintenance schedules, typical warranty, and lifespan.`
}

Return ONLY valid JSON (no markdown, no backticks, nothing else):
{
  "item": "${resolvedItem || `${resolvedBrand} ${resolvedModel}`.trim() || "Appliance"}",
  "brand": "${resolvedBrand}",
  "model": "${resolvedModel}",
  "upc_verified": ${upcData ? "true" : "false"},
  "docs_found": ${manufacturerContent ? "true" : "false"},
  "category": "one of: HVAC, Appliance, Plumbing, Electrical, Roofing, Structure, Safety, Landscaping, Other",
  "condition": "Good",
  "confidence": "${upcData ? "high" : manufacturerContent ? "high" : "medium"}",
  "lifespan_years": <number — from docs if available, else typical for this product>,
  "warranty_years": <number or null — exact from docs>,
  "warranty_expiry": <"YYYY-MM-DD" or null — calculated from install_date + warranty_years if known>,
  "years_remaining": <number or null>,
  "replacement_cost_low": <number — current US retail>,
  "replacement_cost_high": <number>,
  "replacement_cost_note": "<where this range comes from>",
  "contractor_cost_low": ${isPlus ? "<number or null — professional install cost>" : "null"},
  "contractor_cost_high": ${isPlus ? "<number or null>" : "null"},
  "contractor_note": "${isPlus ? "<install note>" : ""}",
  "om_manual_url": "<actual URL from the sources above if found, else empty string>",
  "manual_url": "<alternate manual URL if found, else empty string>",
  "support_url": "<manufacturer support URL from sources if found, else empty string>",
  "maintenance_tip": "<single most important tip from the owner manual, or best practice>",
  "condition_assessment": "<one sentence about condition at this age>",
  "data_sources": ${JSON.stringify(sourceUrls.slice(0, 3))},
  "pm_schedule": [
    {
      "title": "<exact task name — from manual if available>",
      "interval_months": <number>,
      "diy": <true or false>,
      "description": "<specific how-to from the manual, or best practice>"
    }
  ]
}

Return 3-6 pm_schedule tasks specific to THIS exact product. Use the manual content if available.
Tasks must be product-specific — not generic "clean the appliance" instructions.`;

    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
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
    const data    = parseAIJson(rawText);

    if (!data) {
      return new Response(JSON.stringify({ ok: false, error: "Could not parse AI response", raw: rawText.slice(0,200) }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    // Attach UPC image if we got one and AI didn't find a product image
    if (upcData?.image && !data.product_image) {
      data.product_image = upcData.image;
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
    });
  }
});
