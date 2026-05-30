// ─── PROPERTY LOOKUP SERVICE ─────────────────────────────────────────────────
// Based on APIllow v1 documented response format:
// POST /v1/properties → { job_id }
// GET /v1/results/{job_id} → { status, results: [{ success, zpid, property: { ... } }] }

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
  console.log("[APIllow] Looking up:", address);
  console.log("[APIllow] Key present:", !!APILLOW_KEY, "prefix:", APILLOW_KEY?.slice(0,8));

  // ── Step 1: Submit job
  const submitResp = await fetch(`${BASE}/properties`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": APILLOW_KEY,
    },
    body: JSON.stringify({ addresses: [address] }),
  });

  const submitText = await submitResp.text();
  console.log("[APIllow] Submit status:", submitResp.status, "body:", submitText.slice(0,300));

  if (!submitResp.ok) throw new Error(`Submit failed ${submitResp.status}: ${submitText.slice(0,200)}`);

  const submitData = JSON.parse(submitText);
  const jobId = submitData.job_id;
  if (!jobId) throw new Error("No job_id in response: " + submitText.slice(0,200));

  console.log("[APIllow] Job ID:", jobId);

  // ── Step 2: Poll for results
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 3000));
    console.log(`[APIllow] Poll ${i+1}/15 for job ${jobId}`);

    const pollResp = await fetch(`${BASE}/results/${jobId}`, {
      headers: { "X-API-Key": APILLOW_KEY },
    });

    const pollText = await pollResp.text();
    console.log(`[APIllow] Poll ${i+1} status:`, pollResp.status, "body:", pollText.slice(0,400));

    if (!pollResp.ok) throw new Error(`Poll failed ${pollResp.status}: ${pollText.slice(0,200)}`);

    const pollData = JSON.parse(pollText);

    if (pollData.status === "failed") throw new Error("Job failed");

    if (pollData.status === "complete") {
      const results = pollData.results || [];
      console.log("[APIllow] Results count:", results.length);

      if (results.length === 0) return null;

      // Find first successful result
      const r = results.find(r => r.success) || results[0];
      console.log("[APIllow] Result success:", r.success, "zpid:", r.zpid);
      console.log("[APIllow] Property keys:", Object.keys(r.property || r));

      // Per docs: property data is at r.property
      const p = r.property || r;

      console.log("[APIllow] Street address:", p.street_address);
      console.log("[APIllow] Year built:", p.year_built);
      console.log("[APIllow] Beds:", p.bedrooms, "Baths:", p.bathrooms);
      console.log("[APIllow] Zestimate:", p.zestimate, "Last sold:", p.last_sold_price);

      // Price history — find last sold event
      const priceHistory = Array.isArray(p.price_history) ? p.price_history : [];
      const lastSale = priceHistory.find(h =>
        h.event?.toLowerCase().includes("sold") || h.event?.toLowerCase().includes("sale")
      ) || null;

      // Tax history — last 5 years most recent first
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

      // Schools — top 3 by rating
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

      // Primary photo — upgrade to highest quality available
      const imageUrls = p.image_urls || [];
      const rawPhoto = imageUrls.length > 0 ? imageUrls[0] : null;
      // Zillow URLs contain size params like cc_ft_384 or cc_ft_960
      // Swap to uncropped_scaled_within_1536_1152 for best quality
      const photoUrl = rawPhoto
        ? rawPhoto
            .replace(/cc_ft_\d+/g, "cc_ft_1536")
            .replace(/cc_ft_\d+x\d+/g, "cc_ft_1536")
            .replace(/_p_\w+\./g, "_p_f.")  // some URLs use _p_ size codes
        : null;

      const result = {
        address: [p.street_address, p.city, p.state, p.zipcode].filter(Boolean).join(", "),
        type:      mapPropertyType(p.property_type),
        year:      p.year_built ? String(p.year_built) : "",
        sqft:      p.living_area ? String(p.living_area) : "",
        bedrooms:  p.bedrooms != null ? String(p.bedrooms) : "",
        bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
        lot_size:  p.lot_size ? String(Math.round(p.lot_size)) + " sqft" : "",
        last_sale_price: p.last_sold_price || lastSale?.price || "",
        last_sale_date:  lastSale?.date || "",
        zestimate:       p.zestimate || "",
        rent_zestimate:  p.rent_zestimate || "",
        hoa_fee:         p.hoa_fee || "",
        tax_history:     taxHistory,
        price_history:   priceHistory.slice(0, 10),
        schools:         schools,
        photo_url:       photoUrl,
        description:     p.description || "",
        zpid:            String(r.zpid || ""),
        latitude:        p.latitude || "",
        longitude:       p.longitude || "",
      };

      console.log("[APIllow] Final result:", result);
      return result;
    }
    // Still processing — continue polling
  }

  throw new Error("Timed out after 45 seconds");
}
