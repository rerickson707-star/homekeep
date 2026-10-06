// Server-side entry used ONLY by scripts/prerender.mjs at build time.
// It turns each public route into plain HTML so crawlers that do not run JavaScript
// (Bing, DuckDuckGo, AI search bots) still get the page's real content.
import { renderToString } from "react-dom/server";
import * as App from "./App.jsx";

export const PRERENDER_PATHS = Object.keys(App.PRERENDER_PAGES);
export const { seoTitle, seoClip, SEO_DESC_MAX, SEO_SITE_URL, fetchSanityPosts, BLOG_POSTS_FALLBACK } = App;

export function renderRoute(path, posts) {
  globalThis.__SW_BLOG_POSTS__ = posts;
  globalThis.__SW_PATH__ = path;
  let seo = {};
  globalThis.__SW_SEO_SINK__ = (o) => { seo = { ...seo, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) }; };
  try {
    let el;
    if (path === "/") el = <><style>{App.APP_CSS}</style><App.LandingPage onSignIn={() => {}} onSignUp={() => {}} /></>;
    else if (path === "/blog") el = <App.BlogIndex />;
    else if (path.startsWith("/blog/")) el = <App.BlogPost slug={path.slice("/blog/".length)} />;
    else if (path === "/404") el = <App.NotFoundPage />;
    else if (App.PRERENDER_PAGES[path]) { const C = App.PRERENDER_PAGES[path]; el = <C />; }
    else throw new Error("No component for " + path);
    return { html: renderToString(el), seo };
  } finally {
    delete globalThis.__SW_SEO_SINK__;
    delete globalThis.__SW_BLOG_POSTS__;
    delete globalThis.__SW_PATH__;
  }
}
