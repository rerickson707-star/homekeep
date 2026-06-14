import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ANTHROPIC_API  = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TAVILY_KEY     = Deno.env.get("TAVILY_API_KEY") || "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DAILY_LIMIT    = 40;   // uncached calls per user per day
const CACHE_TTL_DAYS = 90;   // days before a cached result expires

function cacheKey(brand: string, model: string): string {
  return (brand.toLowerCase().trim() + "|" + model.toLowerCase().trim()).replace(/\s+/g, " ");
}

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

async function tavilySearch(brand: string, model: string, item: string) {
  if (!TAVILY_KEY) return [];
  const brandClean = brand.toLowerCase().replace(/\s+/g, "");
  const q = (model || item) + " " + brand + " maintenance schedule warranty manual";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TAVILY_KEY },
      body: JSON.stringify({
        query: q, max_results: 3, search_depth: "basic",
        include_domains: [brandClean + ".com", "support." + brandClean + ".com", "manualslib.com", "manuals.plus"],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || [])
      .map((r: Record<string,string>) => ({ url: r.url||"", content: r.content||"" }))
      .filter((r: {url:string}) => r.url);
  } catch { return []; }
}

function parseJSON(text: string) {
  let s = text.replace(/```json\n?|```\n?/g, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 1);
  try { return JSON.parse(s); } catch { /* fall through */ }
  const withoutPM = s.replace(/"pm_schedule"\s*:\s*\[[\s\S]*$/, '"pm_schedule": []}');
  try { return JSON.parse(withoutPM); } catch { /* fall through */ }
  const opens = (s.match(/\[/g)||[]).length - (s.match(/\]/g)||[]).length;
  const openB = (s.match(/\{/g)||[]).length - (s.match(/\}/g)||[]).length;
  let fixed = s;
  if (opens > 0) fixed += "]".repeat(Math.min(opens, 5));
  if (openB > 0) fixed += "}".repeat(Math.min(openB, 3));
  try { return JSON.parse(fixed); } catch { return null; }
}

function buildPrompt(productName: string, brand: string, model: string, category: string, installDate: string, upcData: Record<string,string>|null, manufacturerContent: string, sourceUrls: string[], isPlus: boolean): string {
  let p = "Home appliance expert. Return maintenance data as JSON.\n\n";
  p += "Product: " + productName + "\n";
  p += "Brand: " + (brand || "?") + " | Model: " + (model || "?") + " | Category: " + (category || "?") + "\n";
  if (installDate) p += "Installed: " + installDate + "\n";
  if (upcData) p += "UPC verified: " + upcData.title + " by " + upcData.brand + "\n";
  if (manufacturerContent) p += "\nSources:\n" + manufacturerContent + "\n";
  p += "\nReturn ONLY this JSON (fill in real values):\n";
  p += '{"item":"' + productName.replace(/"/g,"'") + '","brand":"' + brand.replace(/"/g,"'") + '","model":"' + model.replace(/"/g,"'") + '",';
  p += '"upc_verified":' + (upcData?"true":"false") + ',"docs_found":' + (manufacturerContent?"true":"false") + ',';
  p += '"category":"Appliance","condition":"Good","confidence":"' + (upcData?"high":manufacturerContent?"high":"medium") + '",';
  p += '"lifespan_years":10,"warranty_years":1,"warranty_expiry":null,"years_remaining":null,';
  p += '"replacement_cost_low":0,"replacement_cost_high":0,"replacement_cost_note":"",';
  p += '"contractor_cost_low":' + (isPlus?"null":"null") + ',"contractor_cost_high":null,"contractor_note":"",';
  p += '"om_manual_url":"","manual_url":"","support_url":"",';
  p += '"maintenance_tip":"","condition_assessment":"",';
  p += '"data_sources":' + JSON.stringify(sourceUrls.slice(0,2)) + ',';
  p += '"pm_schedule":[{"title":"task","interval_months":6,"diy":true,"description":"how-to"}]}';
  p += "\n\nReplace ALL placeholder values with real data for " + productName + ".";
  p += "\npm_schedule: 3 tasks max, descriptions under 60 chars. No trailing commas. Valid JSON only.";
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.text();
    if (!body) return new Response(JSON.stringify({ ok: false, error: "Body required" }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 400,
    });

    const parsed      = JSON.parse(body);
    const brand       = parsed.brand      || "";
    const model       = parsed.model      || "";
    const item        = parsed.item       || "";
    const upc         = parsed.upc        || "";
    const category    = parsed.category   || "";
    const installDate = parsed.install_date || "";
    const tier        = parsed.tier       || "free";
    const userId      = parsed.user_id    || "";
    const isPlus      = tier === "plus" || tier === "pro";
    const barcodeSearch = parsed.barcode_search || false;

    // Init Supabase client (service role — can bypass RLS for cache writes)
    const sb = (SUPABASE_URL && SUPABASE_KEY)
      ? createClient(SUPABASE_URL, SUPABASE_KEY)
      : null;

    // ── Barcode web search path ──────────────────────────────────────────
    if (barcodeSearch && upc) {
      let productName = "", productBrand = "", productModel = "";
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + TAVILY_KEY },
          body: JSON.stringify({
            query: upc, max_results: 5, search_depth: "basic",
            include_domains: ["amazon.com","homedepot.com","walmart.com","bestbuy.com","target.com","lowes.com"],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const results = json.results || [];
          if (results.length > 0) {
            const combined = results.slice(0,3)
              .map((r: Record<string,string>) => (r.title||"") + " " + (r.content||""))
              .join("\n").slice(0, 1000);
            const aiRes = await fetch(ANTHROPIC_API, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model: "claude-haiku-4-5", max_tokens: 256,
                messages: [{ role: "user", content: "Barcode " + upc + " retail listings. Return ONLY JSON: {\"item\":\"name\",\"brand\":\"brand\",\"model\":\"model or empty\"}\n\n" + combined }],
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

    // ── UPC lookup ────────────────────────────────────────────────────────
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

    // ── Check cache first ─────────────────────────────────────────────────
    const key = cacheKey(resolvedBrand, resolvedModel);
    if (sb && resolvedBrand && resolvedModel) {
      const { data: cached } = await sb
        .from("smart_fill_cache")
        .select("result")
        .eq("cache_key", key)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached?.result) {
        // Cache hit — return immediately, no API calls, no rate limit consumed
        return new Response(JSON.stringify({ ok: true, data: cached.result, cached: true }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // ── Rate limit check (only for uncached calls) ────────────────────────
    if (sb && userId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await sb
        .from("smart_fill_usage")
        .select("call_count")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .single();

      const callCount = usage?.call_count || 0;

      if (callCount >= DAILY_LIMIT) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Daily Smart Fill limit reached (" + DAILY_LIMIT + " lookups/day). Resets at midnight.",
          limit_reached: true,
          count: callCount,
          limit: DAILY_LIMIT,
        }), { headers: { ...CORS, "Content-Type": "application/json" }, status: 429 });
      }

      // Increment counter (upsert so first call of day creates the row)
      await sb.from("smart_fill_usage").upsert({
        user_id: userId,
        usage_date: today,
        call_count: callCount + 1,
      }, { onConflict: "user_id,usage_date" });
    }

    // ── Tavily search ─────────────────────────────────────────────────────
    let manufacturerContent = "";
    let sourceUrls: string[] = [];
    try {
      const results = await tavilySearch(resolvedBrand, resolvedModel, resolvedItem);
      sourceUrls = results.map(r => r.url);
      manufacturerContent = results
        .map(r => "URL: " + r.url + "\n" + r.content.slice(0, 800))
        .join("\n---\n")
        .slice(0, 3000);
    } catch { manufacturerContent = ""; }

    // ── Call Claude ───────────────────────────────────────────────────────
    const prompt = buildPrompt(productName, resolvedBrand, resolvedModel, category, installDate, upcData, manufacturerContent, sourceUrls, isPlus);

    const aiResp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });

    if (!aiResp.ok) {
      const err = await aiResp.text();
      return new Response(JSON.stringify({ ok: false, error: "AI error: " + err.slice(0, 200) }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    const aiJson  = await aiResp.json();
    const rawText = aiJson.content?.[0]?.text || "";
    const data    = parseJSON(rawText);

    if (!data) {
      return new Response(JSON.stringify({ ok: false, error: "Could not parse AI response", raw: rawText.slice(0, 400) }), {
        headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
      });
    }

    if (!Array.isArray(data.pm_schedule)) data.pm_schedule = [];

    // ── Store in cache for future users ──────────────────────────────────
    if (sb && resolvedBrand && resolvedModel) {
      const expires = new Date();
      expires.setDate(expires.getDate() + CACHE_TTL_DAYS);
      await sb.from("smart_fill_cache").upsert({
        cache_key: key,
        brand: resolvedBrand,
        model: resolvedModel,
        result: data,
        expires_at: expires.toISOString(),
      }, { onConflict: "cache_key" });
    }

    return new Response(JSON.stringify({ ok: true, data, cached: false }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" }, status: 500,
    });
  }
});
