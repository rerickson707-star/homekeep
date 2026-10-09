// Steadwell buyer-guide registry.
//
// One entry per PDF guide. Pages, URLs, the sitemap and checkout all read from here, so adding a
// guide means adding one entry (plus uploading its PDF to private storage), not building a page.
//
// This file is display data only. It is safe to bundle into the browser and to import from Node
// (prerender and the sitemap). It must NEVER decide what a person may download or what they pay:
//   - Prices shown here are for display. Checkout looks the price up on the server by guide id.
//   - The full PDFs live in a PRIVATE storage bucket (see storageKey) and are handed out as
//     short-lived signed links after the server has confirmed payment. Never put a paid PDF in public/.
//   - Never put a secret, a Stripe key or a user id in this file.

// Edition label and the "as of" month shown on every guide page (month and year, never an exact day).
export const GUIDE_EDITION = "2026-27";
export const GUIDE_CURRENT_AS_OF = "October 2026";

// Display prices in US dollars. A bundle is one state guide plus one county guide from that state.
export const GUIDE_PRICES = { state: 14.99, county: 29.99, bundle: 37.99 };

// Plan perk for bundle buyers. Off until the length and plan are decided. When it is turned on, the
// grant must be made on the server (after payment is confirmed), never from the browser, and without
// touching the guard_profile_plan trigger. "enabled: false" means no page may mention a trial.
export const BUNDLE_TRIAL = { enabled: false, plan: null, days: null };

export const GUIDES = [
  {
    id: "fl-state-2026",
    kind: "state",
    status: "live", // "live" | "draft" (draft entries get no page, no sitemap line, no checkout)
    stateName: "Florida",
    stateSlug: "florida",
    countyName: null,
    countySlug: null,
    path: "/guides/florida",
    title: "The Florida First-Time Buyer Guide",
    shortName: "Florida State Guide",
    tagline: "What to check, what to watch for, and what it really costs to buy your first home in Florida.",
    edition: GUIDE_EDITION,
    currentAsOf: GUIDE_CURRENT_AS_OF,
    pages: 30,
    seo: {
      title: "Florida First-Time Buyer Guide 2026-27 | Steadwell",
      description: "A plain-English Florida first-time buyer guide: flood vs. evacuation zones, inspections, insurance, closing costs and homestead. Checked October 2026.",
    },
    // Private storage keys (Supabase Storage, bucket "guides"). Not URLs.
    full: { storageKey: "florida/florida-state-2026.pdf" },
    // Free section behind an email address: pages of the real guide, cut into their own small PDF.
    preview: { gated: true, pages: [1, 4], storageKey: "florida/florida-state-2026-preview.pdf" },
    inside: [
      "Every inspection you may need, what it finds and what it costs",
      "Flood zones vs. evacuation zones, explained in plain English",
      "Red flags to watch for in Florida homes, condos and listings",
      "Down payment help, closing costs, insurance and property taxes, worked out",
      "Condo safety laws, HOAs, CDDs, scams, checklists and a first-year plan",
    ],
    chapters: [
      { n: 1, title: "Money and loans", summary: "Loan types, what lenders look at, cash you'll need, and Florida's down payment programs." },
      { n: 2, title: "Choosing the right home", summary: "Houses, condos, townhomes, new construction and manufactured homes; what a home's age tells you in Florida." },
      { n: 3, title: "Flood zones vs. evacuation zones", summary: "The two maps every Florida buyer must check, what each means, and how to read them." },
      { n: 4, title: "What to look out for", summary: "Red flags in the house, the paperwork, the listing and the neighborhood." },
      { n: 5, title: "Inspections: which ones you need", summary: "What each inspection checks, who can do it, what it costs, and how to use the report." },
      { n: 6, title: "Offers, contracts and disclosures", summary: "Florida contracts, deposits, deadlines, required disclosures and negotiating after inspection." },
      { n: 7, title: "Insurance, flood and hurricane season", summary: "Homeowners, wind, flood and condo policies, deductibles, Citizens, and getting real quotes." },
      { n: 8, title: "Condos, HOAs, CDDs and new homes", summary: "Florida's condo safety laws, association documents, CDD taxes and builder contracts." },
      { n: 9, title: "Closing costs and closing day", summary: "Doc stamps, title insurance, a worked example, and how to avoid wire fraud." },
      { n: 10, title: "Property taxes and the homestead", summary: "Homestead, Save Our Homes, the reset that surprises buyers, and Amendment 3." },
      { n: 11, title: "Your first year", summary: "First 90 days, a Florida maintenance calendar, and keeping records." },
      { n: 12, title: "Checklists, glossary and sources", summary: "Everything in one place to print and use." },
    ],
    // Facts in the PDF that expire. Review the guide (and the page copy) on or before reviewBy.
    reviewBy: "2026-11-04",
    reviewNotes: [
      "Amendment 3 (homestead exemption) is decided on Nov 3, 2026. The guide's 'Dates that matter' list and Chapter 10 describe it as pending.",
      "Citizens flood-coverage requirement starts Jan 1, 2027 (Chapter 7).",
    ],
  },

  {
    id: "fl-pinellas-2026",
    kind: "county",
    status: "live",
    stateName: "Florida",
    stateSlug: "florida",
    countyName: "Pinellas",
    countySlug: "pinellas-county",
    path: "/guides/florida/pinellas-county",
    title: "Buying Your First Home in Pinellas County",
    shortName: "Pinellas County Guide",
    tagline: "St. Petersburg, Clearwater, Largo, the beaches and everywhere in between.",
    edition: GUIDE_EDITION,
    currentAsOf: GUIDE_CURRENT_AS_OF,
    pages: 23,
    seo: {
      title: "Pinellas County First-Time Buyer Guide 2026-27 | Steadwell",
      description: "Buying a first home in Pinellas County: flood and evacuation zones after Helene and Milton, down payment programs, taxes and local offices. Checked October 2026.",
    },
    full: { storageKey: "florida/pinellas-county-2026.pdf" },
    preview: { gated: true, pages: [1, 3], storageKey: "florida/pinellas-county-2026-preview.pdf" },
    inside: [
      "Pinellas flood zones vs. evacuation zones, and what storm surge does in each",
      "What to look out for after Helene and Milton, and which inspections to add",
      "Up to $75,000 in county down payment help, plus HFA, city and recovery programs",
      "What your tax bill will really be, with a worked example",
      "Seawalls, mangroves, water rules, local offices, checklists and phone numbers",
    ],
    chapters: [
      { n: 1, title: "Pinellas at a glance", summary: "The four parts of the county, every city's population and tax rate, and daily-life details." },
      { n: 2, title: "Flood zones vs. evacuation zones in Pinellas", summary: "The two risk maps, what storm surge does in each zone, and the 49% rule." },
      { n: 3, title: "What to look out for in Pinellas", summary: "Local red flags, including homes repaired or flipped after Helene and Milton." },
      { n: 4, title: "Inspections for Pinellas homes", summary: "Which inspections to add for the county's age, water and storm history." },
      { n: 5, title: "Every down payment program in Pinellas", summary: "County, HFA, city, state and recovery programs, with their status as of October 2026." },
      { n: 6, title: "What your tax bill will really be", summary: "How a Pinellas tax bill is built, why it resets when a home sells, and a worked example." },
      { n: 7, title: "Insurance and closing in Pinellas", summary: "Where the county's age, coastline and 2024 storms show up most." },
      { n: 8, title: "Your first 90 days in Pinellas", summary: "Filing for homestead and what to do after you get the keys." },
      { n: 9, title: "Pinellas checklists", summary: "Printable checklists, starting before you make an offer." },
      { n: 10, title: "Sources and notes", summary: "Every source, checked October 2026." },
    ],
    reviewBy: "2026-11-04",
    reviewNotes: [
      "The Amendment 3 vote (Nov 3, 2026) is referenced for the homestead section and the 'Your first 90 days' advice.",
      "Down payment program status, income limits and caps change often. Re-check Chapter 5 before each edition.",
      "Tax rates are the 2025 millage published by the Pinellas Tax Collector. Replace with 2026 rates when published.",
    ],
  },
];

// ─── lookups ─────────────────────────────────────────────────────────────────

const clean = (p) => String(p || "").split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase() || "/";

export function liveGuides() {
  return GUIDES.filter((g) => g.status === "live");
}

export function guideById(id) {
  return liveGuides().find((g) => g.id === id) || null;
}

export function guideByPath(path) {
  const p = clean(path);
  return liveGuides().find((g) => g.path === p) || null;
}

export function stateGuide(stateSlug) {
  return liveGuides().find((g) => g.kind === "state" && g.stateSlug === stateSlug) || null;
}

export function countyGuides(stateSlug) {
  return liveGuides().filter((g) => g.kind === "county" && g.stateSlug === stateSlug);
}

// One row per state that has at least one live guide, for the /guides hub.
export function guideStates() {
  const seen = new Map();
  for (const g of liveGuides()) {
    if (!seen.has(g.stateSlug)) {
      seen.set(g.stateSlug, { stateName: g.stateName, stateSlug: g.stateSlug, path: "/guides/" + g.stateSlug });
    }
  }
  return [...seen.values()].map((s) => ({ ...s, state: stateGuide(s.stateSlug), counties: countyGuides(s.stateSlug) }));
}

// The /guides hub itself is a page too; callers (prerender, sitemap) add it.
export function guidePagePaths() {
  const paths = liveGuides().map((g) => g.path);
  for (const s of guideStates()) if (!paths.includes(s.path)) paths.push(s.path);
  return paths;
}

// A bundle is the state guide plus one county guide from that state.
export function bundleFor(countyGuideId) {
  const county = guideById(countyGuideId);
  if (!county || county.kind !== "county") return null;
  const state = stateGuide(county.stateSlug);
  if (!state) return null;
  const separate = +(GUIDE_PRICES.state + GUIDE_PRICES.county).toFixed(2);
  return { state, county, price: GUIDE_PRICES.bundle, separate, saves: +(separate - GUIDE_PRICES.bundle).toFixed(2) };
}

export function guidesDueForReview(today = new Date().toISOString().slice(0, 10)) {
  return liveGuides().filter((g) => g.reviewBy && g.reviewBy <= today);
}

// Returns a list of problems; an empty list means the registry is consistent.
export function validateRegistry() {
  const out = [];
  const ids = new Set();
  const paths = new Set();
  for (const g of GUIDES) {
    const tag = g.id || "(no id)";
    if (!g.id) out.push("entry without an id");
    if (ids.has(g.id)) out.push(tag + ": duplicate id");
    ids.add(g.id);
    if (paths.has(g.path)) out.push(tag + ": duplicate path " + g.path);
    paths.add(g.path);
    if (g.kind !== "state" && g.kind !== "county") out.push(tag + ": kind must be state or county");
    if (!/^\/guides\/[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(g.path)) out.push(tag + ": bad path " + g.path);
    const want = g.kind === "state" ? "/guides/" + g.stateSlug : "/guides/" + g.stateSlug + "/" + g.countySlug;
    if (g.path !== want) out.push(tag + ": path should be " + want);
    if (g.kind === "county" && (!g.countyName || !g.countySlug)) out.push(tag + ": county guide needs countyName and countySlug");
    if (g.kind === "county" && !GUIDES.some((x) => x.kind === "state" && x.stateSlug === g.stateSlug)) out.push(tag + ": county guide has no state guide for " + g.stateSlug);
    if (!g.seo || g.seo.title.length > 62) out.push(tag + ": seo.title missing or over 62 characters");
    if (!g.seo || g.seo.description.length < 70 || g.seo.description.length > 165) out.push(tag + ": seo.description should be 70 to 165 characters");
    if (!g.pages || g.pages < 1) out.push(tag + ": pages missing");
    if (!g.full || !g.full.storageKey || /^https?:|^\/|public/.test(g.full.storageKey)) out.push(tag + ": full.storageKey must be a private storage key, not a URL or public path");
    if (g.preview) {
      const [a, b] = g.preview.pages || [];
      if (!(a >= 1 && b >= a && b < g.pages)) out.push(tag + ": preview.pages must be inside the guide and shorter than the full guide");
      if (!g.preview.storageKey || g.preview.storageKey === g.full.storageKey) out.push(tag + ": preview needs its own storageKey");
    }
    if (!Array.isArray(g.chapters) || !g.chapters.length) out.push(tag + ": chapters missing");
    if (!Array.isArray(g.inside) || !g.inside.length) out.push(tag + ": inside list missing");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.reviewBy || "")) out.push(tag + ": reviewBy must be YYYY-MM-DD");
  }
  if (!(GUIDE_PRICES.bundle < GUIDE_PRICES.state + GUIDE_PRICES.county)) out.push("bundle price must be lower than buying separately");
  if (BUNDLE_TRIAL.enabled && (!BUNDLE_TRIAL.plan || !(BUNDLE_TRIAL.days > 0))) out.push("BUNDLE_TRIAL enabled without a plan and a number of days");
  return out;
}
