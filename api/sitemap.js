// Live sitemap, served at /sitemap.xml (see vercel.json). Blog posts come straight from Sanity,
// so a newly published post appears here within about an hour with no rebuild or redeploy.
// If Sanity cannot be reached, the static pages and the known posts are still served.

const SITE = "https://www.trysteadwell.app";
const SANITY = "https://1r1eichb.api.sanity.io/v2024-01-01/data/query/production";

// Public, indexable pages and when each last changed in a meaningful way. Bump lastmod when a page's
// content changes. /for-agents is intentionally absent (it is noindex).
const PAGES = [
  ["/", "2026-10-06"],
  ["/pricing", "2026-10-06"],
  ["/blog", "2026-10-06"],
  ["/warranty-tracker", "2026-10-06"],
  ["/utility-bill-tracker", "2026-10-06"],
  ["/home-condition-assessment", "2026-10-06"],
  ["/recall-alerts", "2026-10-06"],
  ["/home-maintenance-tracker", "2026-10-06"],
  ["/home-expense-tracker", "2026-10-06"],
  ["/ai-scan", "2026-10-06"],
  ["/email-capture", "2026-10-06"],
  ["/contractor-tracker", "2026-10-06"],
  ["/home-insurance-tracker", "2026-10-06"],
  ["/home-projects", "2026-10-06"],
  ["/home-document-vault", "2026-10-06"],
  ["/ask-steadwell", "2026-10-06"],
  ["/home-health-score", "2026-10-06"],
  ["/calendar-sync", "2026-10-06"],
  ["/shared-household-access", "2026-10-06"],
  ["/guides", "2026-07-09"],
  ["/affiliates", "2026-09-16"],
  ["/affiliate-agreement", "2026-09-16"],
  ["/terms", "2026-09-22"],
  ["/privacy", "2026-10-01"],
  ["/ada", "2026-07-09"],
];

// Posts that must not be listed (for example a duplicate that now redirects elsewhere).
const EXCLUDE_SLUGS = new Set(["first-30-days-new-home-checklist"]);

// Used only if Sanity is unreachable.
const FALLBACK_POSTS = [
  "new-homeowner-checklist-first-30-days", "home-maintenance-checklist", "hvac-maintenance-schedule",
  "how-old-is-my-water-heater", "roof-lifespan-when-to-replace", "how-to-find-age-of-house",
  "find-appliance-serial-number", "what-does-a-home-warranty-cover", "cost-of-deferred-maintenance",
  "steadwell-vs-homezada", "steadwell-vs-homebinder", "centriq-alternative",
].map((slug) => ({ slug, lastmod: "2026-06-01" }));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : null);

async function loadPosts() {
  const query = '*[_type == "blogPost" && defined(slug.current)] | order(publishedAt desc) { "slug": slug.current, publishedAt, _updatedAt }';
  const res = await fetch(`${SANITY}?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Sanity responded ${res.status}`);
  const { result } = await res.json();
  if (!Array.isArray(result) || !result.length) throw new Error("Sanity returned no posts");
  return result
    .filter((p) => p.slug && /^[a-z0-9][a-z0-9-]*$/i.test(p.slug))
    .map((p) => ({ slug: p.slug, lastmod: day(p._updatedAt) || day(p.publishedAt) }));
}

export default async function handler(req, res) {
  let posts = FALLBACK_POSTS;
  let live = false;
  try { posts = await loadPosts(); live = true; } catch (e) { console.error("[sitemap] using fallback posts:", e && e.message); }

  // Posts rewritten in src/blog-overrides.js carry their own modified date.
  try {
    const overrides = (await import("../src/blog-overrides.js")).BLOG_OVERRIDES || {};
    posts = posts.map((p) => {
      const m = overrides[p.slug] && day(overrides[p.slug].modified);
      return m && m > (p.lastmod || "") ? { ...p, lastmod: m } : p;
    });
  } catch (e) { console.error("[sitemap] overrides not applied:", e && e.message); }

  const urls = [
    ...PAGES.map(([p, lastmod]) => ({ loc: SITE + (p === "/" ? "/" : p), lastmod })),
    ...posts.filter((p) => !EXCLUDE_SLUGS.has(p.slug)).map((p) => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.lastmod })),
  ];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    "\n</urlset>\n";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // One hour when live; retry sooner after a fallback so a Sanity blip does not stick.
  res.setHeader("Cache-Control", live ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=300");
  res.status(200).send(xml);
}
