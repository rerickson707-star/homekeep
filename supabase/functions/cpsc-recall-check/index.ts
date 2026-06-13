import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Handle GET health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "cpsc-recall-check", status: "ready" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Request body required" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { brand, productType, model, serialNumber } = JSON.parse(body);

    if (!brand) {
      return new Response(JSON.stringify({ ok: false, error: "brand is required" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Search CPSC by manufacturer — use first word only for best results
    const searchTerm = encodeURIComponent(brand.split(" ")[0]);
    const cpscUrl = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&Manufacturer=${searchTerm}`;

    const cpscRes = await fetch(cpscUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!cpscRes.ok) {
      return new Response(JSON.stringify({ ok: true, recalls: [], note: "CPSC API unavailable" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const text = await cpscRes.text();
    if (!text || text.trim() === "") {
      return new Response(JSON.stringify({ ok: true, recalls: [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      return new Response(JSON.stringify({ ok: true, recalls: [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const getFullText = (r: any): string => [
      r.Title || "",
      (r.Products || []).map((p: any) => p.Description || "").join(" "),
      r.Description || "",
      (r.Hazards || []).map((h: any) => h.Name || h.Description || "").join(" "),
    ].join(" ").toLowerCase();

    const typeWords = (productType || "")
      .toLowerCase()
      .replace(/hvac/gi, "air conditioner heating furnace")
      .split(/\s+/)
      .filter((w: string) => w.length > 3);

    const modelClean = (model || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const serialClean = (serialNumber || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const requireModelMatch = modelClean.length >= 6;

    const recalls = data
      .filter((r: any) => {
        const fullText = getFullText(r);
        if (typeWords.length > 0 && !typeWords.some((w: string) => fullText.includes(w))) return false;
        if (requireModelMatch) {
          const textFlat = fullText.replace(/[^a-z0-9]/g, "");
          const modelInText = textFlat.includes(modelClean);
          const modelInProducts = (r.Products || []).some((p: any) =>
            (p.Model || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(modelClean) ||
            (p.Description || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(modelClean)
          );
          if (!modelInText && !modelInProducts) return false;
        }
        return true;
      })
      .map((r: any) => {
        const fullText = getFullText(r);
        const textFlat = fullText.replace(/[^a-z0-9]/g, "");
        const modelMatch = modelClean.length >= 4 && textFlat.includes(modelClean);
        const serialMatch = serialClean.length >= 4 && textFlat.includes(serialClean);
        return {
          recallNumber: r.RecallID || r.RecallNumber || "",
          title: r.Title || "",
          date: r.RecallDate ? r.RecallDate.slice(0, 10) : "",
          hazard: (r.Hazards || []).map((h: any) => h.Name || h.Description || "").filter(Boolean).join(", "),
          remedy: (r.Remedies || []).map((rem: any) => rem.Name || "").filter(Boolean).join(", "),
          url: r.URL || `https://www.cpsc.gov/Recalls/${r.RecallID || ""}`,
          products: (r.Products || []).map((p: any) => p.Description || "").filter(Boolean).join(", "),
          confidence: serialMatch ? "high" : modelMatch ? "high" : requireModelMatch ? "medium" : "low",
          matchNote: serialMatch ? "Serial number match" : modelMatch ? "Model number match" : "Brand & category match",
        };
      });

    return new Response(JSON.stringify({ ok: true, recalls }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...CORS, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
