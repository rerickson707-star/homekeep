// middleware.ts — injects real per-page <title>/description/OG/canonical tags
// server-side, for crawlers, link-preview bots, and AI answer engines that
// don't execute JavaScript. Real visitors get the exact same HTML; the
// client-side useSEO() hook then takes over exactly as it does today, so
// nothing about the actual app experience changes.
//
// Framework-agnostic Vercel Routing Middleware -- plain Web APIs (Request/
// Response/URL), no Next.js-specific imports, since this is a Vite project.

const SANITY_PROJECT_ID = "1r1eichb";
const SANITY_DATASET = "production";

// Pulled directly from each page's real useSEO() call in App.jsx -- not
// hand-written copy, so this can never drift from what the page actually
// says. If you update a page's useSEO() title/description, update it here
// too (or ask Claude to re-sync this table from the source next time).
const STATIC_PAGES = {
  "/affiliate-agreement": { title: "Affiliate Agreement | Steadwell", description: "Steadwell affiliate program terms — commission rates, cookie window, payout schedule, and prohibited promotion methods." },
  "/affiliates": { title: "Steadwell Affiliate Program — Earn Recurring Commissions | Steadwell", description: "Partner with Steadwell and earn 30% recurring commissions for 12 months on every paid plan you refer. Built for home improvement creators, real estate agents, and personal finance writers." },
  "/ai-scan": { title: "AI Receipt & Nameplate Scanner for Home Management | Steadwell", description: "Scan any receipt, appliance nameplate, or insurance document with your camera. Steadwell AI extracts the details automatically — no typing required." },
  "/blog": { title: "Home Maintenance Blog — Tips, Guides & Comparisons | Steadwell", description: "Expert guides on home maintenance, appliance care, repair costs, and home management apps. Practical advice for every homeowner." },
  "/contractor-tracker": { title: "Home Contractor Tracker — Save Trusted Pros | Steadwell", description: "Save your trusted contractors, log every service visit, and track what each one has cost. Free for all plans." },
  "/email-capture": { title: "Forward Receipts to Steadwell — Automatic Home Record Capture | Steadwell", description: "Forward any receipt, invoice, or warranty document to your unique Steadwell address. We extract the details and file them automatically. Free for all plans." },
  "/for-agents": { title: "Steadwell for Real Estate Agents — A Closing Gift Clients Remember | Steadwell", description: "Give every client a closing gift that keeps your name in their home all year. Free to you, valuable to them. Apply to the Steadwell agent partner program." },
  "/guides": { title: "First-Time Homebuyer Guides — All 50 States | Steadwell", description: "State-specific first-time homebuyer guides covering assistance programs, disclosure laws, inspection checklists, and county-level intelligence. Pick your state." },
  "/home-document-vault": { title: "Home Document Vault — Store Deeds, Permits & More | Steadwell", description: "Store every important home document in one secure place. Deeds, permits, inspection reports, manuals, HOA documents — always findable when you need them." },
  "/home-expense-tracker": { title: "Home Expense Tracker & 5-Year Cost Forecast | Steadwell", description: "Track every dollar your home costs you and see a 5-year forecast of upcoming expenses based on your appliance ages. Free to start." },
  "/home-insurance-tracker": { title: "Home Insurance Organizer — Track Policies & Claims | Steadwell", description: "Store your home insurance policies, log claims, and get annual renewal reminders. Everything ready before you ever need to file." },
  "/home-maintenance-tracker": { title: "Home Maintenance Schedule App — Never Miss a Task | Steadwell", description: "Track every home maintenance task with reminders, recurring schedules, and a complete service history. Free for all plans." },
  "/home-projects": { title: "Home Renovation Tracker with ROI Calculator | Steadwell", description: "Track every home renovation project with budgets, timelines, and a Cost vs. Value ROI calculator. See what each project adds to your home&#39;s resale value." },
  "/recall-alerts": { title: "Product Safety Recall Alerts for Your Home | Steadwell", description: "Find out if anything in your home has been recalled. Steadwell checks every tracked product against the CPSC database automatically — appliances, tools, electronics, safety devices, and more." },
};

function injectMeta(html, { title, description, canonical, image }) {
  const ogImage = image || "https://www.trysteadwell.app/og-image.png";
  html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" content=".*?">/,
    `<meta name="description" content="${description}">`
  );
  html = html.replace(
    /<link rel="canonical" href=".*?">/,
    `<link rel="canonical" href="${canonical}">`
  );
  html = html.replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${title}">`);
  html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${description}">`);
  html = html.replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${ogImage}">`);
  html = html.replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${title}">`);
  html = html.replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${description}">`);
  return html;
}

async function fetchBlogPost(slug) {
  try {
    const query = encodeURIComponent(
      `*[_type == "blogPost" && slug.current == "${slug}"][0] { title, description, "image": mainImage.asset->url }`
    );
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${query}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result || null;
  } catch {
    return null;
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  let meta = null;

  if (path === "/blog" || path === "/blog/") {
    // blog index uses the static table entry below
  } else if (path.startsWith("/blog/")) {
    const slug = path.replace("/blog/", "").replace(/\/$/, "");
    const post = await fetchBlogPost(slug);
    if (post && post.title) {
      meta = {
        title: `${post.title} | Steadwell`,
        description: post.description || "Home maintenance guidance from Steadwell.",
        canonical: `https://www.trysteadwell.app/blog/${slug}`,
        image: post.image,
      };
    }
  }

  if (!meta && STATIC_PAGES[path]) {
    meta = {
      ...STATIC_PAGES[path],
      canonical: `https://www.trysteadwell.app${path}`,
    };
  }

  if (!meta) {
    return; // not a page we have metadata for -- let it pass through unchanged
  }

  // Fetch the app's own normal HTML shell and inject the real metadata into it
  const originResponse = await fetch(new URL("/index.html", request.url));
  let html = await originResponse.text();
  html = injectMeta(html, meta);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    "/blog",
    "/blog/:path*",
    "/for-agents",
    "/affiliates",
    "/affiliate-agreement",
    "/ai-scan",
    "/email-capture",
    "/home-maintenance-tracker",
    "/contractor-tracker",
    "/home-insurance-tracker",
    "/home-expense-tracker",
    "/home-projects",
    "/home-document-vault",
    "/recall-alerts",
    "/guides",
  ],
};
