// ─── PROPERTY LOOKUP SERVICE ─────────────────────────────────────────────────
const APILLOW_KEY = import.meta.env.VITE_APILLOW_KEY;
const BASE = "https://api.apillow.co/v1";

function mapPropertyType(type) {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("sfr") || t.includes("house")) return "Single Family";
  if (t.includes("town") || t.includes("row")) return "Townhouse";
  if (t.includes("condo") || t.includes("apt") || t.includes("apartment")) return "Condo";
  if (t.includes("mobile") || t.includes("manufactured")) return "Mobile Home";
  if (t.includes("multi") || t.includes("duplex") || t.includes("triplex")) return "Multi-Family";
  return "Other";
}

export async function lookupProperty(address) {
  console.log("[APIllow] Starting lookup for:", address);
  console.log("[APIllow] Key present:", !!APILLOW_KEY, "Key prefix:", APILLOW_KEY?.slice(0,8));

  // ── Step 1: Submit
  let submitResp;
  try {
    submitResp = await fetch(`${BASE}/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": APILLOW_KEY,
      },
      body: JSON.stringify({ addresses: [address] }),
    });
  } catch(e) {
    console.error("[APIllow] Network error on submit:", e);
    throw new Error("Network error — check your connection");
  }

  const submitText = await submitResp.text();
  console.log("[APIllow] Submit status:", submitResp.status);
  console.log("[APIllow] Submit response:", submitText.slice(0, 500));

  if (!submitResp.ok) {
    throw new Error(`Submit failed (${submitResp.status}): ${submitText.slice(0,200)}`);
  }

  let submitData;
  try { submitData = JSON.parse(submitText); }
  catch(e) { throw new Error("Submit returned non-JSON: " + submitText.slice(0,200)); }

  // ── Step 2: Get results (immediate or polled)
  let results;

  if (submitData.results) {
    // Sync response — results returned immediately
    console.log("[APIllow] Got immediate results");
    results = submitData.results;
  } else if (submitData.job_id) {
    // Async response — need to poll
    console.log("[APIllow] Got job_id:", submitData.job_id, "— polling...");
    results = await pollResults(submitData.job_id);
  } else {
    console.error("[APIllow] No results or job_id in response:", submitData);
    throw new Error("Unexpected response structure");
  }

  console.log("[APIllow] Results count:", results?.length);
  console.log("[APIllow] First result keys:", results?.[0] ? Object.keys(results[0]) : "none");
  console.log("[APIllow] First result (truncated):", JSON.stringify(results?.[0])?.slice(0, 800));

  if (!results || results.length === 0) return null;

  // ── Step 3: Extract property object
  const r = results[0];
  // Try all known shapes
  const p = r.property || r.result || (r.street_address ? r : null) || r;

  console.log("[APIllow] Property keys:", Object.keys(p || {}));

  if (!p) return null;

  // ── Price history
  const priceHistory = Array.isArray(p.price_history) ? p.price_history : [];
  const lastSale = priceHistory.find(h =>
    h.event?.toLowerCase().includes("sold") || h.event?.toLowerCase().includes("sale")
  ) || null;

  // ── Tax history
  const taxHistory = Array.isArray(p.tax_history)
    ? [...p.tax_history]
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, 5)
        .map(t => ({
          year:           t.year || "",
          tax_paid:       t.tax_paid || t.taxPaid || t.amount || "",
          assessed_value: t.value || t.assessed_value || t.assessedValue || "",
        }))
    : [];

  // ── Schools
  const schools = Array.isArray(p.nearby_schools)
    ? [...p.nearby_schools]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 3)
        .map(s => ({
          name:     s.name || "",
          rating:   s.rating || "",
          grades:   s.grades || s.level || "",
          distance: s.distance || "",
        }))
    : [];

  // ── Photo
  const imageUrls = p.image_urls || p.photos || p.images || [];
  const photoUrl = Array.isArray(imageUrls) && imageUrls.length > 0
    ? (typeof imageUrls[0] === "string" ? imageUrls[0] : imageUrls[0]?.url || null)
    : null;

  const result = {
    address: [
      p.street_address || p.address || p.streetAddress,
      p.city,
      p.state,
      p.zipcode || p.zip_code || p.zip,
    ].filter(Boolean).join(", "),
    type:      mapPropertyType(p.property_type || p.home_type || p.homeType),
    year:      String(p.year_built || p.yearBuilt || ""),
    sqft:      String(p.living_area || p.livingArea || p.sqft || ""),
    bedrooms:  String(p.bedrooms || ""),
    bathrooms: String(p.bathrooms || ""),
    lot_size:  (p.lot_size || p.lotSize) ? String(Math.round(p.lot_size || p.lotSize)) + " sqft" : "",
    last_sale_price: lastSale?.price || p.last_sold_price || p.lastSoldPrice || "",
    last_sale_date:  lastSale?.date  || p.last_sold_date  || p.lastSoldDate  || "",
    zestimate:       p.zestimate || "",
    rent_zestimate:  p.rent_zestimate || p.rentZestimate || "",
    hoa_fee:         p.hoa_fee || p.hoaFee || "",
    tax_history:   taxHistory,
    price_history: priceHistory.slice(0, 10),
    schools:       schools,
    photo_url:     photoUrl,
    description:   p.description || "",
    zpid:          String(r.zpid || p.zpid || ""),
    latitude:      p.latitude || "",
    longitude:     p.longitude || "",
  };

  console.log("[APIllow] Final result:", result);
  return result;
}

async function pollResults(jobId, maxAttempts = 15, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    console.log(`[APIllow] Poll attempt ${i+1}/${maxAttempts} for job ${jobId}`);

    let resp;
    try {
      resp = await fetch(`${BASE}/results/${jobId}`, {
        headers: { "X-API-Key": APILLOW_KEY },
      });
    } catch(e) {
      console.error("[APIllow] Network error polling:", e);
      continue;
    }

    const text = await resp.text();
    console.log(`[APIllow] Poll ${i+1} status:`, resp.status, "body:", text.slice(0, 300));

    if (!resp.ok) throw new Error(`Poll failed (${resp.status}): ${text.slice(0,200)}`);

    let data;
    try { data = JSON.parse(text); } catch(e) { continue; }

    if (data.status === "complete") return data.results || [];
    if (data.status === "failed") throw new Error("Job failed: " + JSON.stringify(data));
    // still processing
  }
  throw new Error("Timed out after 45 seconds");
}
