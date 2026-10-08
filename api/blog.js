// Serves /blog/:slug for any post that was not pre-rendered at build time (see vercel.json).
// Pre-rendered posts are static files and never reach this function. For the rest:
//   - a post that exists (published in Sanity after the last build, or listed below): the normal app shell, status 200
//   - a slug that does not exist: the not-found page with status 404 and noindex, so search engines drop it
//     instead of treating it as a thin copy of the homepage
//   - Sanity cannot be reached: the app shell, status 200 (never turn a real post into a 404 because of a blip)

const SANITY = "https://1r1eichb.api.sanity.io/v2024-01-01/data/query/production";

// Same fallback list as api/sitemap.js, used when Sanity is unreachable or has no posts.
const KNOWN_FALLBACK = new Set([
  "new-homeowner-checklist-first-30-days", "home-maintenance-checklist", "hvac-maintenance-schedule",
  "how-old-is-my-water-heater", "roof-lifespan-when-to-replace", "how-to-find-age-of-house",
  "find-appliance-serial-number", "what-does-a-home-warranty-cover", "cost-of-deferred-maintenance",
  "steadwell-vs-homezada", "steadwell-vs-homebinder", "centriq-alternative",
]);

const NOT_FOUND_FALLBACK = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page not found | Steadwell</title><meta name="robots" content="noindex, follow"></head>
<body style="font-family:sans-serif;background:#F4EDDF;color:#2A2723;text-align:center;padding:72px 24px">
<h1 style="font-weight:500;color:#234A3D">We couldn't find that article</h1>
<p><a href="/blog" style="color:#C16140">Browse the Steadwell blog</a> or <a href="/" style="color:#C16140">go to the homepage</a>.</p></body></html>`;

// true = exists, false = does not exist, null = could not tell
async function postExists(slug) {
  if (KNOWN_FALLBACK.has(slug)) return true;
  try {
    const query = "count(*[_type == \"blogPost\" && slug.current == $slug])";
    const url = `${SANITY}?query=${encodeURIComponent(query)}&%24slug=${encodeURIComponent(JSON.stringify(slug))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const { result } = await res.json();
    return typeof result === "number" ? result > 0 : null;
  } catch (e) {
    console.error("[blog] Sanity lookup failed:", e && e.message);
    return null;
  }
}

async function pageFrom(origin, path) {
  try {
    const res = await fetch(origin + path, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const html = await res.text();
    return /<div id="root"/.test(html) ? html : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  const slug = String(req.query && req.query.slug || "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "www.trysteadwell.app";
  const origin = `https://${host}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const valid = /^[a-z0-9][a-z0-9-]*$/i.test(slug) && slug.length <= 120;
  const exists = valid ? await postExists(slug) : false;

  if (exists === false) {
    const html = (await pageFrom(origin, "/404.html")) || NOT_FOUND_FALLBACK;
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(404).send(html);
  }

  // Exists, or could not be checked: serve the normal app and let it load the post.
  const shell = await pageFrom(origin, "/spa-shell.html");
  if (!shell) {
    res.setHeader("Retry-After", "30");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Temporarily unavailable. Please try again in a moment.");
  }
  res.setHeader("Cache-Control", exists === true ? "public, s-maxage=60, stale-while-revalidate=600" : "no-store");
  return res.status(200).send(shell);
}
