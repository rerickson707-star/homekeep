import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TAVILY_KEY    = Deno.env.get("TAVILY_API_KEY") || "";

async function lookupUPC(upc: string) {
  try {
    const res = await fetch("https://api.upcitemdb.com/prod/trial/lookup?upc=" + encodeURIComponent(upc.trim()));
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.items?.[0];
    if (!item) return null;
    return { title: item.title||"", brand: item.brand||"", model: item.model||"", description: item.description||"" };
  } catch { return null; }
}

async function tavilySearch(brand: string, model: string, item: string): Promise<Array<{url:string,content:string}>> {
  if (!TAVILY_KEY) return [];
  const brandClean = brand.toLowerCase().replace(/\s+/g, "");
  const q = (model || item) + " " + brand + " owner manual maintenance warranty";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TAVILY_KEY },
      body: JSON.stringify({
        query: q,
        max_results: 5,
        search_depth: "basic",
        include_domains: [brandClean + ".com", "support." + brandClean + ".com", "manualslib.com", "manuals.plus", "manua.ls"],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || [])
      .map((r: Record<string,string>) => ({ url: r.url||"", content: r.content||"" }))
      .filter((r: {url:string}) => r.url);
  } catch { return []; }
}

function parseJSON(text: string): Record<string,unknown> | null {
  const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /**/ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function buildPrompt(
  productName: string, brand: string, model: string, category: string,
  installDate: string, upcData: Record<string,string>|null, manufacturerContent: string,
  sourceUrls: string[], isPlus: boolean
): string {
  const confidence  = upcData ? "high" : (manufacturerContent ? "high" : "medium");
  const upcVerified = upcData ? "true" : "false";
  const docsFound   = manufacturerContent ? "true" : "false";
  const contrLow    = isPlus ? "number or null" : "null";
  const contrHigh   = isPlus ? "number or null" : "null";
  const sourcesStr  = JSON.stringify(sourceUrls.slice(0, 3));

  let p = "You are a home appliance expert. Extract maintenance data for a home management app.\n\n";
  p += "PRODUCT: " + productName + "\n";
  p += "Brand: " + (brand || "unknown") + "\n";
  p += "Model: " + (model || "unknown") + "\n";
  p += "Category: " + (category || "unknown") + "\n";
  p += "Install date: " + (installDate || "unknown") + "\n";

  if (upcData) {
    p += "\nUPC VERIFIED PRODUCT:\n";
    p += "- Name: " + upcData.title + "\n";
    p += "- Brand: " + upcData.brand + "\n";
    p += "- Model: " + upcData.model + "\n";
  }
  if (manufacturerContent) {
    p += "\nMANUFACTURER DOCS (use as primary source):\n" + manufacturerContent + "\n";
  } else {
    p += "\nNo manufacturer docs found - use your training knowledge for this product.\n";
  }

  p += "\nReturn ONLY valid JSON (no markdown, no backticks, no explanation):\n";
  p += "{\n";
  p += '  "item": "' + productName.replace(/"/g, "'") + '",\n';
  p += '  "brand": "' + brand.replace(/"/g, "'") + '",\n';
  p += '  "model": "' + model.replace(/"/g, "'") + '",\n';
  p += '  "upc_verified": ' + upcVerified + ',\n';
  p += '  "docs_found": ' + docsFound + ',\n';
  p += '  "category": "HVAC or Appliance or Plumbing or Electrical or Roofing or Structure or Safety or Landscaping or Other",\n';
  p += '  "condition": "Good",\n';
  p += '  "confidence": "' + confidence + '",\n';
  p += '  "lifespan_years": 0,\n';
  p += '  "warranty_years": null,\n';
  p += '  "warranty_expiry": null,\n';
  p += '  "years_remaining": null,\n';
  p += '  "replacement_cost_low": 0,\n';
  p += '  "replacement_cost_high": 0,\n';
  p += '  "replacement_cost_note": "",\n';
  p += '  "contractor_cost_low": ' + contrLow + ',\n';
  p += '  "contractor_cost_high": ' + contrHigh + ',\n';
  p += '  "contractor_note": "",\n';
  p += '  "om_manual_url": "",\n';
  p += '  "manual_url": "",\n';
  p += '  "support_url": "",\n';
  p += '  "maintenance_tip": "",\n';
  p += '  "condition_assessment": "",\n';
  p += '  "data_sources": ' + sourcesStr + ',\n';
  p += '  "pm_schedule": [\n';
  p += '    { "title": "", "interval_months": 6, "diy": true, "description": "" }\n';
  p += '  ]\n';
  p += '}\n\n';
  p += "Fill in all values appropriately for " + productName + ". ";
  p += "Return 3-5 pm_schedule tasks specific to this product. ";
  p += "For om_manual_url and support_url: use actual URLs from the manufacturer docs above if present, otherwise leave empty string.";
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.text();
    if (!body) return new Response(JSON.stringify({ ok: false, error: "Body required" }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
    });

    const parsed = JSON.parse(body);
    const brand         = parsed.brand         || "";
    const model         = parsed.model         || "";
    const item          = parsed.item          || "";
    const upc           = parsed.upc           || "";
    const category      = parsed.category      || "";
    const installDate   = parsed.install_date  || "";
    const tier          = parsed.tier          || "free";
    const barcodeSearch = parsed.barcode_search || false;
    const isPlus        = tier === "plus" || tier === "pro";

    // ── Barcode search path ──────────────────────────────────────────────
    if (barcodeSearch && upc) {
      let productName = "", productBrand = "", productModel = "";
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TAVILY_KEY },
          body: JSON.stringify({
            query: upc,
            max_results: 5,
            search_depth: "basic",
            include_domains: ["amazon.com","homedepot.com","walmart.com","bestbuy.com","target.com","lowes.com"],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const results = json.results || [];
          if (results.length > 0) {
            const combined = results.slice(0,3)
              .map((r: Record<string,string>) => (r.title||"") + " " + (r.content||""))
              .join("\n").slice(0, 1500);
            const aiRes = await fetch(ANTHROPIC_API, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model: "claude-haiku-4-5",
                max_tokens: 256,
                messages: [{ role: "user", content: "Extract product name, brand, and model from these retail listings for barcode " + upc + ". Return ONLY JSON: {\"item\":\"full product name\",\"brand\":\"brand\",\"model\":\"model number or empty\"}\n\nListings:\n" + combined }],
              }),
            });
            if (aiRes.ok) {
              const aiJson = await aiRes.json();
              const p = parseJSON(aiJson.content?.[0]?.text || "");
              if (p) {
                productName  = String(p.item  || results[0]?.title || "");
                productBrand = String(p.brand || "");
                const m = String(p.model || "").trim();
                productModel = (m && m !== upc && m.length >= 3 && m.length <= 30) ? m : "";
              }
            }
          }
        }
      } catch { /* return empty */ }
      return new Response(JSON.stringify({ ok: true, data: { item: productName, brand: productBrand, model: productModel, upc_verified: false, docs_found: !!productName, confidence: productModel ? "high" : "medium" } }), {
        headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── UPC lookup ───────────────────────────────────────────────────────
    let upcData: Record<string,string>|null = null;
    if (upc && upc.trim().length >= 8) upcData = await lookupUPC(upc);

    const resolvedBrand = upcData?.brand || brand;
    const resolvedModel = upcData?.model || model;
    const resolvedItem  = upcData?.title || item;
    const productName   = resolvedItem || ((resolvedBrand + " " + resolvedModel).trim()) || "Appliance";

    if (!resolvedBrand && !resolvedModel && !resolvedItem) {
      return new Response(JSON.stringify({ ok: false, error: "brand, model, item, or UPC required" }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
      });
    }

    // ── Tavily search ────────────────────────────────────────────────────
    let manufacturerContent = "";
    let sourceUrls: string[] = [];

    if (resolvedModel || resolvedBrand) {
      try {
        const searchResults = await tavilySearch(resolvedBrand, resolvedModel, resolvedItem);
        sourceUrls = searchResults.map(r => r.url);
        manufacturerContent = searchResults
          .map(r => "SOURCE: " + r.url + "\n" + r.content)
          .join("\n\n---\n\n")
          .slice(0, 8000);
      } catch { manufacturerContent = ""; }
    }

    // ── Build prompt and call Claude ─────────────────────────────────────
    const prompt = buildPrompt(
      productName, resolvedBrand, resolvedModel, category,
      installDate, upcData, manufacturerContent, sourceUrls, isPlus
    );

    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, stream: true, messages: [{ role: "user", content: prompt }] }),
    });

    if (!aiResp.ok) {
      const err = await aiResp.text();
      return new Response(JSON.stringify({ ok: false, error: "AI error: " + err.slice(0, 200) }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    // Stream Claude's response directly to the client as SSE
    // The client accumulates chunks and parses JSON when complete
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode SSE chunks from Anthropic and forward text deltas
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]" || !data) continue;
              try {
                const parsed = JSON.parse(data);
                // content_block_delta contains the actual text
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  const text = parsed.delta.text || "";
                  buffer += text;
                  // Forward as plain text chunk — client will accumulate
                  controller.enqueue(new TextEncoder().encode(text));
                }
              } catch { /* skip malformed SSE lines */ }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Signal end with a sentinel so the client knows streaming is complete
        controller.enqueue(new TextEncoder().encode("\n###DONE###"));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        ...CORS,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
    });
  }
});
