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

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`APIllow submit failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  // Handle both sync (immediate results) and async (job_id) responses
  if (data.results) return { immediate: data.results };
  if (data.job_id) return { job_id: data.job_id };
  throw new Error("Unexpected APIllow response: " + JSON.stringify(data).slice(0, 200));
}

// Poll for results until complete or timeout
async function pollResults(jobId, maxAttempts = 15, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const resp = await fetch(`${BASE}/results/${jobId}`, {
      headers: { "X-API-Key": APILLOW_KEY },
    });
    if (!resp.ok) throw new Error(`Poll failed: ${resp.status}`);
    const data = await resp.json();
    if (data.status === "complete") return data.results || [];
    if (data.status === "failed") throw new Error("Lookup job failed");
    // still processing — continue
  }
  throw new Error("Lookup timed out after 45 seconds");
}

// Safely extract a property object from a result entry
// Handles multiple response shapes APIllow has used
function extractProperty(r) {
  if (!r) return null;
  // Shape 1: { property: {...}, zpid: ... }
  if (r.property && typeof r.property === "object") return { p: r.property, zpid: r.zpid };
  // Shape 2: flat object with street_address directly
  if (r.street_address) return { p: r, zpid: r.zpid };
  // Shape 3: nested under result key
  if (r.result && typeof r.result === "object") return { p: r.result, zpid: r.zpid };
  return null;
}

// Main export — looks up a single address and returns all available home data
export async function lookupProperty(address) {
  const response = await submitLookup(address);

  // Get results — either immediate or via polling
  let results;
  if (response.immediate) {
    results = response.immediate;
  } else {
    results = await pollResults(response.job_id);
  }

  if (!results || results.length === 0) return null;

  const extracted = extractProperty(results[0]);
  if (!extracted) return null;
  const { p, zpid } = extracted;

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
          tax_paid:       t.tax_paid || t.taxPaid || t.amount || "",
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
          grades:   s.grades || s.level || "",
          distance: s.distance || "",
        }))
    : [];

  // ── Primary photo — try multiple field names
  const imageUrls = p.image_urls || p.photos || p.images || [];
  const photoUrl = Array.isArray(imageUrls) && imageUrls.length > 0
    ? (typeof imageUrls[0] === "string" ? imageUrls[0] : imageUrls[0]?.url || null)
    : null;

  // ── Address — try multiple field names
  const addressStr = [
    p.street_address || p.address || p.streetAddress,
    p.city,
    p.state,
    p.zipcode || p.zip_code || p.zip,
  ].filter(Boolean).join(", ");

  return {
    // Address
    address: addressStr,

    // Core home details
    type:      mapPropertyType(p.property_type || p.home_type || p.homeType),
    year:      p.year_built || p.yearBuilt ? String(p.year_built || p.yearBuilt) : "",
    sqft:      p.living_area || p.livingArea ? String(p.living_area || p.livingArea) : "",
    bedrooms:  p.bedrooms ? String(p.bedrooms) : "",
    bathrooms: p.bathrooms ? String(p.bathrooms) : "",
    lot_size:  (p.lot_size || p.lotSize) ? String(Math.round(p.lot_size || p.lotSize)) + " sqft" : "",

    // Financial
    last_sale_price: lastSale?.price || p.last_sold_price || p.lastSoldPrice || "",
    last_sale_date:  lastSale?.date || p.last_sold_date || p.lastSoldDate || "",
    zestimate:       p.zestimate || "",
    rent_zestimate:  p.rent_zestimate || p.rentZestimate || "",
    hoa_fee:         p.hoa_fee || p.hoaFee || "",

    // Rich data
    tax_history:   taxHistory,
    price_history: priceHistory.slice(0, 10),
    schools:       schools,
    photo_url:     photoUrl,
    description:   p.description || "",
    zpid:          zpid ? String(zpid) : "",
    latitude:      p.latitude || "",
    longitude:     p.longitude || "",
  };
}
