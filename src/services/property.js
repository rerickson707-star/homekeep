// ─── PROPERTY LOOKUP SERVICE ─────────────────────────────────────────────────
// All property data API calls live here.
// To swap providers later, only this file needs to change.

const APILLOW_KEY = import.meta.env.VITE_APILLOW_KEY;
const BASE = "https://api.apillow.co/v1";

// Map APIllow property types to our HOME_TYPES list
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

// Submit address lookup — returns a job_id
async function submitLookup(address) {
  const resp = await fetch(`${BASE}/properties`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": APILLOW_KEY,
    },
    body: JSON.stringify({ addresses: [address] }),
  });
  if (!resp.ok) throw new Error(`APIllow submit failed: ${resp.status}`);
  const data = await resp.json();
  if (!data.job_id) throw new Error("No job_id returned");
  return data.job_id;
}

// Poll for results until complete or timeout
async function pollResults(jobId, maxAttempts = 12, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const resp = await fetch(`${BASE}/results/${jobId}`, {
      headers: { "X-API-Key": APILLOW_KEY },
    });
    if (!resp.ok) throw new Error(`Poll failed: ${resp.status}`);
    const data = await resp.json();
    if (data.status === "complete") return data.results || [];
    if (data.status === "failed") throw new Error("Lookup job failed");
  }
  throw new Error("Lookup timed out after 36 seconds");
}

// Main export — looks up a single address and returns all available home data
export async function lookupProperty(address) {
  const jobId = await submitLookup(address);
  const results = await pollResults(jobId);

  if (!results || results.length === 0) return null;

  const r = results[0];
  if (!r.success) return null;
  const p = r.property || r;

  // ── Price history — find last sold event
  const priceHistory = Array.isArray(p.price_history) ? p.price_history : [];
  const lastSale = priceHistory.find(h =>
    h.event?.toLowerCase().includes("sold") || h.event?.toLowerCase().includes("sale")
  ) || null;

  // ── Tax history — last 5 years, most recent first
  const taxHistory = Array.isArray(p.tax_history)
    ? [...p.tax_history]
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, 5)
        .map(t => ({
          year:           t.year || "",
          tax_paid:       t.tax_paid || t.taxPaid || "",
          assessed_value: t.value || t.assessed_value || t.assessedValue || "",
        }))
    : [];

  // ── Nearby schools — top 3 by rating
  const schools = Array.isArray(p.nearby_schools)
    ? [...p.nearby_schools]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 3)
        .map(s => ({
          name:     s.name || "",
          rating:   s.rating || "",
          grades:   s.grades || "",
          distance: s.distance || "",
        }))
    : [];

  // ── Primary photo
  const photoUrl = Array.isArray(p.image_urls) && p.image_urls.length > 0
    ? p.image_urls[0]
    : null;

  return {
    // Address
    address: [p.street_address, p.city, p.state, p.zipcode]
      .filter(Boolean).join(", "),

    // Core home details
    type:      mapPropertyType(p.property_type || p.home_type),
    year:      p.year_built ? String(p.year_built) : "",
    sqft:      p.living_area ? String(p.living_area) : "",
    bedrooms:  p.bedrooms ? String(p.bedrooms) : "",
    bathrooms: p.bathrooms ? String(p.bathrooms) : "",
    lot_size:  p.lot_size ? String(Math.round(p.lot_size)) + " sqft" : "",

    // Financial
    last_sale_price: lastSale?.price || p.last_sold_price || "",
    last_sale_date:  lastSale?.date || "",
    zestimate:       p.zestimate || "",
    rent_zestimate:  p.rent_zestimate || "",
    hoa_fee:         p.hoa_fee || "",

    // Rich data
    tax_history:   taxHistory,
    price_history: priceHistory.slice(0, 10),
    schools:       schools,
    photo_url:     photoUrl,
    description:   p.description || "",
    zpid:          r.zpid ? String(r.zpid) : "",
    latitude:      p.latitude || "",
    longitude:     p.longitude || "",
  };
}
