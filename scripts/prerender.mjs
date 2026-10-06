// Build-time pre-rendering.
/* global process */
//
// Runs after `vite build`. Renders every public page (home, features, pricing, legal, blog) to
// real HTML with its own <title>, description, canonical and structured data, so crawlers that
// do not execute JavaScript (Bing, DuckDuckGo, ChatGPT/Perplexity-style bots) see the content.
// Browsers still load the normal React app, which replaces the snapshot when it starts.
//
// SAFETY: this script never fails the deploy. Any error leaves the plain single-page build in
// place (dist/index.html unchanged except for being copied to dist/spa-shell.html).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const root = process.cwd();
const dist = path.join(root, "dist");
const ssrDir = path.join(root, ".ssr-build");
const log = (...a) => console.log("[prerender]", ...a);

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonForScript = (o) => JSON.stringify(o).split("<").join("\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");

// Replace a tag if the template has it, otherwise add it before </head>.
function setTag(html, re, tag) {
  return re.test(html) ? html.replace(re, () => tag) : html.replace("</head>", () => `    ${tag}\n  </head>`);
}

function applyHead(tpl, route, seo, mod) {
  const title = mod.seoTitle(seo.title);
  const desc = mod.seoClip(seo.description || "", mod.SEO_DESC_MAX) || null;
  const canonical = seo.canonical || `${mod.SEO_SITE_URL}${route === "/" ? "/" : route}`;
  let h = tpl;
  h = setTag(h, /<title>[\s\S]*?<\/title>/, `<title>${escText(title)}</title>`);
  if (desc) {
    h = setTag(h, /<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escAttr(desc)}">`);
    h = setTag(h, /<meta\s+property="og:description"[^>]*>/, `<meta property="og:description" content="${escAttr(desc)}">`);
    h = setTag(h, /<meta\s+name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escAttr(desc)}">`);
  }
  h = setTag(h, /<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${escAttr(canonical)}">`);
  h = setTag(h, /<meta\s+property="og:url"[^>]*>/, `<meta property="og:url" content="${escAttr(canonical)}">`);
  h = setTag(h, /<meta\s+property="og:title"[^>]*>/, `<meta property="og:title" content="${escAttr(title)}">`);
  h = setTag(h, /<meta\s+name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escAttr(title)}">`);
  if (seo.ogType) h = setTag(h, /<meta\s+property="og:type"[^>]*>/, `<meta property="og:type" content="${escAttr(seo.ogType)}">`);
  if (seo.image) {
    h = setTag(h, /<meta\s+property="og:image"[^>]*>/, `<meta property="og:image" content="${escAttr(seo.image)}">`);
    h = setTag(h, /<meta\s+name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escAttr(seo.image)}">`);
  }
  // The template carries the homepage's structured data; every page gets its own instead.
  h = h.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  if (seo.jsonLd) h = h.replace("</head>", () => `    <script type="application/ld+json" data-seo="dynamic">${jsonForScript(seo.jsonLd)}</script>\n  </head>`);
  if (seo.noindex) h = h.replace("</head>", () => `    <meta name="robots" content="noindex, follow">\n  </head>`);
  return h;
}

function applyBody(h, route, bodyHtml) {
  const snapshot = `<div id="sw-snapshot" data-route="${escAttr(route)}">${bodyHtml}</div>`;
  if (!/<div id="root"><\/div>/.test(h)) throw new Error("template has no empty #root");
  let out = h.replace('<div id="root"></div>', () => `<div id="root">${snapshot}</div>`);
  // Returning (signed-in) visitors go straight to the app, so don't flash the marketing page at them.
  // Visitors without JavaScript get the landing page's scroll-reveal sections shown.
  if (route === "/") {
    out = out.replace("</head>", () => [
      `    <script>try{for(var i=0;i<localStorage.length;i++){if(/^sb-.*-auth-token/.test(localStorage.key(i))){document.documentElement.className+=" sw-returning";break}}}catch(e){}</script>`,
      `    <style>html.sw-returning #sw-snapshot{display:none}</style>`,
      `    <noscript><style>.lp-root .rv{opacity:1!important;transform:none!important}</style></noscript>`,
      `  </head>`,
    ].join("\n"));
  }
  return out;
}

function outFile(route) {
  if (route === "/") return path.join(dist, "index.html");
  if (route === "/404") return path.join(dist, "404.html");
  return path.join(dist, route.replace(/^\//, ""), "index.html");
}

async function main() {
  const tplPath = path.join(dist, "index.html");
  if (!fs.existsSync(tplPath)) { log("dist/index.html missing - run `vite build` first. Skipping."); return; }
  const tpl = fs.readFileSync(tplPath, "utf8");
  // Pure single-page shell: served for app-only routes (login, gift links, admin) and for pages
  // that could not be pre-rendered.
  fs.writeFileSync(path.join(dist, "spa-shell.html"), tpl);
  // The sitemap is generated live by api/sitemap.js; a stale static copy would shadow it.
  fs.rmSync(path.join(dist, "sitemap.xml"), { force: true });

  log("building server bundle...");
  await build({
    configFile: path.join(root, "vite.config.js"),
    logLevel: "warn",
    publicDir: false,
    build: { ssr: "src/prerender-entry.jsx", outDir: ".ssr-build", emptyOutDir: true, minify: false, copyPublicDir: false },
  });
  const mod = await import(pathToFileURL(path.join(ssrDir, "prerender-entry.js")).href);

  let posts = null;
  try { posts = await mod.fetchSanityPosts(); } catch { posts = null; }
  if (!posts || !posts.length) { log("Sanity unavailable - using the built-in posts"); posts = mod.BLOG_POSTS_FALLBACK; }
  else log(`fetched ${posts.length} posts from Sanity`);
  posts = posts.filter((p) => p && p.slug && /^[a-z0-9][a-z0-9-]*$/i.test(p.slug));

  const routes = ["/", "/blog", ...posts.map((p) => `/blog/${p.slug}`), ...mod.PRERENDER_PATHS, "/404"];
  const results = [];
  const failed = [];
  for (const route of routes) {
    try {
      const { html, seo } = mod.renderRoute(route, posts);
      if (html.length < 1500 || !/<h1[\s>]/.test(html)) throw new Error("rendered page looks empty");
      if (route !== "/404" && !seo.canonical) throw new Error("page did not set a canonical URL");
      let page = applyHead(tpl, route, seo, mod);
      page = applyBody(page, route, html);
      results.push({ route, page });
    } catch (e) {
      failed.push(route);
      log(`SKIPPED ${route}: ${e.message}`);
    }
  }
  for (const { route, page } of results) {
    const f = outFile(route);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, page);
  }
  log(`wrote ${results.length} pages${failed.length ? `, skipped ${failed.length} (${failed.join(", ")}) - those load as the normal app` : ""}`);
}

main()
  .catch((e) => {
    console.error("[prerender] FAILED - shipping the plain single-page build instead:", e && e.stack ? e.stack : e);
  })
  .finally(() => {
    try { fs.rmSync(ssrDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
