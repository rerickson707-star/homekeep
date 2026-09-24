// supabase/functions/property-lookup/index.ts
//
// Moves the APIllow property lookup server-side. Fixes two bugs from the
// September 2026 QA pass:
//
//   1. CRITICAL: the APIllow key was read from import.meta.env.VITE_APILLOW_KEY
//      in src/services/property.js. Vite inlines any VITE_-prefixed env var
//      directly into the public JS bundle at build time -- that's the whole
//      point of the VITE_ prefix -- so the key was sitting in plain text in
//      index-*.js for anyone to copy and run up the APIllow bill with. Here,
//      APILLOW_KEY is a normal (non-VITE_) Supabase secret: it lives only on
//      the server and is never shipped to the browser.
//   2. The client file logged every step to the browser console, including
//      the key prefix, job IDs, and the full parsed Zillow response. Moving
//      the whole submit/poll/parse flow here means none of that ever reaches
//      a visitor's browser console. What logging remains here is server-side
//      only (visible to you in the Supabase dashboard, never to a visitor),
//      and deliberately still never logs the key itself or a full response
//      body -- just status codes and counts, enough to debug a stuck job
//      without echoing sensitive data into logs unnecessarily.
//
// This endpoint requires a valid user session (deployed WITHOUT
// --no-verify-jwt) -- every call costs a real APIllow credit, and every
// caller in the app is already an authenticated user, so there's no
// legitimate reason to let this be reachable anonymously. supabase-js's
// functions.invoke() attaches the caller's session JWT automatically, so
// this needs no change on top of what the client already does.
//
// Deploy:
//   npx supabase secrets set APILLOW_KEY=zs_weEg...      (the REAL key -- see rotation note below)
//   npx supabase functions deploy property-lookup
//
// IMPORTANT -- rotate the key: the OLD key (starting zs_weEg, from the public
// bundle) must be treated as burned. Get a new key from the APIllow dashboard,
// set it as APILLOW_KEY above, and revoke/delete the old one there. Deploying
// this function alone does not invalidate the leaked key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const APILLOW_KEY = Deno.env.get("APILLOW_KEY")!;
const BASE = "https://api.apillow.co/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function mapPropertyType(type: string | undefined | null): string {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("sfr") || t.includes("house")) return "Single Family";
  if (t.includes("town") || t.includes("row")) return "Townhouse";
  if (t.includes("condo") || t.includes("apt") || t.includes("apartment")) return "Condo";
  if (t.includes("mobile") || t.includes("manufactured")) return "Mobile Home";
  if (t.includes("multi") || t.includes("duplex") || t.includes("triplex")) return "Multi-Family";
  return "Other";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!APILLOW_KEY) {
    console.error("[property-lookup] APILLOW_KEY secret is not set");
    return json({ error: "Property lookup is not configured" }, 500);
  }

  let address: string;
  try {
    const body = await req.json();
    address = (body?.address || "").trim();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!address) return json({ error: "address is required" }, 400);

  try {
    // ── Step 1: Submit job ────────────────────────────────────────────────
    const submitResp = await fetch(`${BASE}/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": APILLOW_KEY,
      },
      body: JSON.stringify({ addresses: [address] }),
    });

    const submitText = await submitResp.text();
    if (!submitResp.ok) {
      console.error(`[property-lookup] Submit failed: ${submitResp.status}`);
      return json({ error: `Submit failed ${submitResp.status}` }, 502);
    }

    const submitData = JSON.parse(submitText);
    const jobId = submitData.job_id;
    if (!jobId) {
      console.error("[property-lookup] No job_id in submit response");
      return json({ error: "No job_id in response" }, 502);
    }

    // ── Step 2: Poll for results (45s max, matching the previous client logic) ─
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollResp = await fetch(`${BASE}/results/${jobId}`, {
        headers: { "X-API-Key": APILLOW_KEY },
      });
      const pollText = await pollResp.text();

      if (!pollResp.ok) {
        console.error(`[property-lookup] Poll ${i + 1}/15 failed: ${pollResp.status}`);
        return json({ error: `Poll failed ${pollResp.status}` }, 502);
      }

      const pollData = JSON.parse(pollText);

      if (pollData.status === "failed") {
        console.error(`[property-lookup] Job ${jobId} failed`);
        return json({ error: "Job failed" }, 502);
      }

      if (pollData.status === "complete") {
        const results = pollData.results || [];
        if (results.length === 0) return json({ result: null });

        const r = results.find((x: any) => x.success) || results[0];
        const p = r.property || r;

        const priceHistory = Array.isArray(p.price_history) ? p.price_history : [];
        const lastSale =
          priceHistory.find(
            (h: any) => h.event?.toLowerCase().includes("sold") || h.event?.toLowerCase().includes("sale")
          ) || null;

        const taxHistory = Array.isArray(p.tax_history)
          ? [...p.tax_history]
              .sort((a: any, b: any) => (b.year || 0) - (a.year || 0))
              .slice(0, 5)
              .map((t: any) => ({
                year: t.year || "",
                tax_paid: t.tax_paid || t.taxPaid || t.amount || "",
                assessed_value: t.value || t.assessed_value || t.assessedValue || "",
              }))
          : [];

        const schools = Array.isArray(p.nearby_schools)
          ? [...p.nearby_schools]
              .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
              .slice(0, 3)
              .map((s: any) => ({
                name: s.name || "",
                rating: s.rating || "",
                grades: s.grades || s.level || "",
                distance: s.distance || "",
              }))
          : [];

        const imageUrls = p.image_urls || [];
        const rawPhoto = imageUrls.length > 0 ? imageUrls[0] : null;
        const photoUrl = rawPhoto
          ? rawPhoto
              .replace(/cc_ft_\d+/g, "cc_ft_1536")
              .replace(/cc_ft_\d+x\d+/g, "cc_ft_1536")
              .replace(/_p_\w+\./g, "_p_f.")
          : null;

        const result = {
          address: [p.street_address, p.city, p.state, p.zipcode].filter(Boolean).join(", "),
          type: mapPropertyType(p.property_type),
          year: p.year_built ? String(p.year_built) : "",
          sqft: p.living_area ? String(p.living_area) : "",
          bedrooms: p.bedrooms != null ? String(p.bedrooms) : "",
          bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
          lot_size: p.lot_size ? String(Math.round(p.lot_size)) + " sqft" : "",
          last_sale_price: p.last_sold_price || lastSale?.price || "",
          last_sale_date: lastSale?.date || "",
          zestimate: p.zestimate || "",
          rent_zestimate: p.rent_zestimate || "",
          hoa_fee: p.hoa_fee || "",
          tax_history: taxHistory,
          price_history: priceHistory.slice(0, 10),
          schools: schools,
          photo_url: photoUrl,
          description: p.description || "",
          zpid: String(r.zpid || ""),
          latitude: p.latitude || "",
          longitude: p.longitude || "",
        };

        return json({ result });
      }
      // Still processing — continue polling
    }

    console.error(`[property-lookup] Job ${jobId} timed out after 45s`);
    return json({ error: "Timed out after 45 seconds" }, 504);
  } catch (err) {
    console.error("[property-lookup] Fatal error:", err instanceof Error ? err.message : String(err));
    return json({ error: "Property lookup failed" }, 500);
  }
});
