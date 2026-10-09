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

// Plan perk for bundle buyers: 3 months of Plus, card required up front (a Stripe subscription with a
// trial; it bills the normal Plus price when the trial ends unless the person cancels). It is offered
// as an opt-in after the guide purchase, never added to the cart automatically. "enabled: false" means
// the server flow does not exist yet, so NO page or email may mention a trial. When it is turned on the
// grant happens on the server (Stripe webhook), never from the browser, and the guard_profile_plan
// trigger is left alone.
export const BUNDLE_TRIAL = { enabled: false, plan: "plus", days: 90, cardRequired: true };

// Email-gate wording. Change GUIDE_CONSENT_VERSION whenever the sentence changes; the version is stored
// with every lead as proof of what the person agreed to.
export const GUIDE_CONSENT_VERSION = "guides-v1";
export const GUIDE_CONSENT_TEXT = "Email me the free preview and occasional home-buying tips from Steadwell. I can unsubscribe at any time.";

// Questions asked at the email gate. The codes are what gets stored; the same codes are checked by
// supabase/functions/guide-preview/index.ts (scripts/check-guides.mjs fails if they drift apart).
export const GUIDE_LEAD_OPTIONS = {
  stage: [
    { code: "exploring", label: "Just starting to look" },
    { code: "preapproval", label: "Getting pre-approved" },
    { code: "touring", label: "Touring homes" },
    { code: "offer", label: "Made an offer" },
    { code: "contract", label: "Under contract" },
    { code: "closed", label: "Just closed" },
  ],
  timeline: [
    { code: "0-3", label: "In the next 3 months" },
    { code: "3-6", label: "In 3 to 6 months" },
    { code: "6-12", label: "In 6 to 12 months" },
    { code: "12+", label: "More than a year away" },
    { code: "unsure", label: "Not sure yet" },
  ],
  concerns: [
    { code: "downpayment", label: "Saving for the down payment" },
    { code: "insurance", label: "Insurance costs" },
    { code: "flood", label: "Flood and storm risk" },
    { code: "inspection", label: "Inspections and repairs" },
    { code: "taxes", label: "Property taxes" },
    { code: "hoa", label: "HOA and condo rules" },
    { code: "closing", label: "Closing costs" },
    { code: "agent", label: "Finding an agent or lender" },
  ],
  agent: [
    { code: "yes", label: "Yes" },
    { code: "no", label: "Not yet" },
  ],
};

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
    images: {
      cover: { src: "/guide-img/florida-cover.jpg", w: 720, h: 932, alt: "Cover of The Florida First-Time Buyer Guide" },
      pages: [
        { src: "/guide-img/florida-start.jpg", w: 720, h: 932, alt: "Start here page: how the guide works, dates that matter and the ten-step Florida buying timeline", label: "Start here" },
        { src: "/guide-img/florida-dates.jpg", w: 720, h: 932, alt: "Dates that matter right now, how to use the guide, and the ten-step Florida buying timeline", label: "Dates and timeline" },
      ],
    },
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
    preview: {
      gated: true, pages: [1, 4], storageKey: "florida/florida-state-2026-preview.pdf",
      includes: [
        "The cover and the full table of contents",
        "Start here: how the guide works and what changes in Florida",
        "Dates that matter right now",
        "The ten-step Florida buying timeline",
      ],
    },
    updated: "2026-10-09",
    // Evergreen numbers shown on the page. Anything that expires on a date (votes, deadlines in force
    // only this year) belongs in reviewNotes instead, not here.
    facts: [
      { value: "1% to 3%", label: "Typical escrow (earnest money) deposit, as a share of the price. Negotiable.", source: "Steadwell Florida guide, Chapter 1" },
      { value: "2% to 5%", label: "Rough range for total closing costs, as a share of the price.", source: "Steadwell Florida guide, Chapter 1" },
      { value: "March 1", label: "Homestead filing deadline each year. You must own and live in the home on January 1.", source: "Steadwell Florida guide, Chapter 10" },
      { value: "June 1 to Nov 30", label: "Hurricane season. Insurers can pause new policies when a storm threatens, which can delay a closing.", source: "Steadwell Florida guide, Chapter 7" },
    ],
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
    images: {
      cover: { src: "/guide-img/pinellas-cover.jpg", w: 720, h: 932, alt: "Cover of Buying Your First Home in Pinellas County" },
      pages: [
        { src: "/guide-img/pinellas-start.jpg", w: 720, h: 932, alt: "Start here page: the Pinellas County market at a glance and which jurisdiction an address is in", label: "Start here" },
        { src: "/guide-img/pinellas-offices.jpg", w: 720, h: 932, alt: "Local offices and tools page with phone numbers for Pinellas County", label: "Local offices" },
      ],
    },
    edition: GUIDE_EDITION,
    currentAsOf: GUIDE_CURRENT_AS_OF,
    pages: 23,
    seo: {
      title: "Pinellas County First-Time Buyer Guide 2026-27 | Steadwell",
      description: "Buying a first home in Pinellas County: flood and evacuation zones after Helene and Milton, down payment programs, taxes and local offices. Checked October 2026.",
    },
    full: { storageKey: "florida/pinellas-county-2026.pdf" },
    preview: {
      gated: true, pages: [1, 3], storageKey: "florida/pinellas-county-2026-preview.pdf",
      includes: [
        "The cover and what's inside",
        "Start here: why Pinellas is different from the rest of Florida",
        "The market at a glance, July 2026",
        "How to tell which of the 24 jurisdictions an address is in",
        "Local offices and tools, with phone numbers",
      ],
    },
    updated: "2026-10-09",
    facts: [
      { value: "$469,000", label: "Median single-family sale price, July 2026 (up 7.8% from a year earlier).", source: "Pinellas REALTOR Organization, July 2026" },
      { value: "34 days", label: "Median time to contract for single-family homes, July 2026. Condos took 69.", source: "Pinellas REALTOR Organization, July 2026" },
      { value: "24", label: "Cities and towns in the county, plus unincorporated areas. The jurisdiction sets your tax rate and flood rules.", source: "Steadwell Pinellas guide, Start here" },
      { value: "Up to $75,000", label: "County down payment assistance. Eligibility, caps and funding change often; status checked October 2026.", source: "Pinellas County Community Development" },
    ],
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.updated || "")) out.push(tag + ": updated must be YYYY-MM-DD");
    if (!g.facts || g.facts.length < 3 || g.facts.some((f) => !f.value || !f.label || !f.source)) out.push(tag + ": facts need at least 3 entries, each with value, label and source");
    if (g.preview && (!Array.isArray(g.preview.includes) || !g.preview.includes.length)) out.push(tag + ": preview.includes missing");
    const im = g.images;
    if (!im || !im.cover || !Array.isArray(im.pages) || im.pages.length < 1) out.push(tag + ": images.cover and at least one images.pages entry needed");
    else for (const x of [im.cover, ...im.pages]) if (!/^\/guide-img\/[a-z0-9-]+\.(jpg|webp|png)$/.test(x.src || "") || !(x.w > 0 && x.h > 0) || !x.alt) out.push(tag + ": image " + (x.src || "?") + " needs a /guide-img/ path, w, h and alt text");
  }
  if (!(GUIDE_PRICES.bundle < GUIDE_PRICES.state + GUIDE_PRICES.county)) out.push("bundle price must be lower than buying separately");
  if (BUNDLE_TRIAL.enabled && (!BUNDLE_TRIAL.plan || !(BUNDLE_TRIAL.days > 0) || BUNDLE_TRIAL.cardRequired !== true)) out.push("BUNDLE_TRIAL enabled without a plan, a number of days and cardRequired: true");
  for (const k of ["stage", "timeline", "concerns", "agent"]) {
    const list = GUIDE_LEAD_OPTIONS[k];
    if (!Array.isArray(list) || !list.length || new Set(list.map((o) => o.code)).size !== list.length) out.push("GUIDE_LEAD_OPTIONS." + k + " missing or has duplicate codes");
  }
  return out;
}
