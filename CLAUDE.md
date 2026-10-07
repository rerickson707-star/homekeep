# Steadwell (homekeep repo)

Steadwell is a home-management SaaS for homeowners at trysteadwell.app, built and run by one person (Robert Erickson III, Steadwell LLC, Florida). Stack: React + Vite, Supabase, Vercel (project "homekeep"), Stripe, Resend, Sanity (blog). Repo: github.com/rerickson707-star/homekeep. Windows + PowerShell.

Robert prefers exact commands over UI click-paths, and short answers: say what changed, what to test, the next step.

## Release flow (hard rules)
- Work on `dev`. Push only to `dev`. NEVER push to `main`, merge into `main`, or force-push `main`.
- Vercel's Production branch is `main`, but Robert releases by promoting a `dev` preview deployment to Production in Vercel. Never do this for him.
- Test on the dev preview (homekeep-git-dev-rerickson707-star1.vercel.app). Localhost login is unreliable, so do not treat a localhost login failure as a bug.
- Commit only the files you changed (`git add <files>`, not `git add .`). Run `git status --short` first. Fallback if a push is rejected: `git push --force-with-lease origin dev`, never plain `--force`.
- Never commit secrets (service role keys, API keys, .env files). The Supabase anon key hardcoded in App.jsx is known and accepted.

## App.jsx
- `src/App.jsx` is one ~32,000-line file by design. Do not split it or reformat it. Do not read the whole file: use Grep to find the function or const, then Read only that range.
- Line 1 is the version header: `// Steadwell vNNN — <ISO date>`. Bump the number and date on every change to App.jsx (check the current number on line 1; it was v340 on 2026-10-07).
- Named React imports only (`useMemo`, never `React.useMemo`).
- Prefer deleting broken logic over patching it. The asset tabs are always mounted, so state is preserved without restore code.
- Check your work: `npm run build` (runs `vite build && node scripts/prerender.mjs`). Both steps must pass. Prerender fetches the blog posts from Sanity.
- Design: pine #234A3D, cream #F4EDDF, terracotta/rust #C16140. Fonts: Fraunces (headings), Hanken Grotesk (body). Use the existing CSS variables (`--pine`, `--cream`, `--stone`, `--dark`). Robert catches color, alignment and price drift, so match existing patterns.
- Every change must work at 320px wide and on desktop. No horizontal page scroll.
- Global CSS strips native input appearance (`input{-webkit-appearance:none;width:100%}`). Custom-style checkboxes and radios; do not rely on the native look.

## Plans and pricing (keep every mention consistent)
- Free; Plus $7.99/mo or $63.99/yr; Pro $14.99/mo or $119.99/yr. Gating lives in the `PLANS` object and `usePlan()` near the end of App.jsx. The plan comes from the oldest profile the user owns.
- Home health score: everyone sees the overall score; the breakdown by factor is Plus and Pro.
- Tier claims must be accurate. Never advertise a feature on a tier that does not have it. When changing a gate, search for every mention (pricing page, FAQ, tile tags, Terms).
- PDF guides: state $14.99, county $29.99, bundle $37.99.

## Copy and content rules
- Marketing and web copy must NOT name Anthropic or Claude. Say "AI" or "a third-party AI provider". Anthropic may be named only where required for compliance (Terms, Privacy Policy).
- Do not use the word "helper" in copy.
- Audience is the whole US. Florida may appear as one example, never as the default.
- Blog: author stays "Steadwell". Never create a duplicate post; improve the existing one in place. Posts live in Sanity plus code overrides in `src/blog-overrides.js` (figure units allowed: "$", "yrs", "%", "", "yr", "days"; keep charts to 6 ticks or fewer so they fit at 320px). Back every statistic with a source.
- Landing-page navigation uses real links (`<a href="/pricing">`, `/blog`), not scroll-only buttons, so search engines can follow them.

## Routing, SEO and static pages
- The app uses a hand-rolled path switch, not a router library. New public pages need an entry in `PRERENDER_PAGES` (so they are prerendered with a `#sw-snapshot`) and must appear in the sitemap function.
- Static pages in `public/` (Terms, Privacy, accessibility, warranty-tracker) are plain HTML. `vercel.json` has an SPA catch-all rewrite, so each static page needs its own rewrite entry placed BEFORE the catch-all (for example `/terms` to `/terms.html`) or visitors get index.html.

## Supabase
- Project ref: hjkyameroqufaojuerns. New tables get RLS enabled by default; a missing policy returns empty results silently, so test with a real user.
- Edge functions: from the client, prefer `supabase.functions.invoke()` for proper error surfacing. Most functions read the custom secrets `DB_URL` and `SERVICE_ROLE_KEY` (plus `RESEND_API_KEY`); `asset-intelligence` uses the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Several functions are deployed with `--no-verify-jwt` (agent-setup-save, ical-feed, gift-expiry-check, redeem-agent-gift, send-gift-email, agent-welcome); do not change that without asking.
- NEVER manually invoke a cron-scheduled function (warranty-alerts, gift-expiry-check): a manual run alongside the scheduled one causes double email delivery. `email_log` exists for idempotency but is not wired in yet.
- `guard_profile_plan` trigger on `profiles` blocks plan escalation. Do not weaken it.
- The plan is decided on the server. Never trust a plan, tier or user id sent from the browser.

## Smart Fill (asset lookup)
- Client: `smartFillLookup`, `smartFillChanges`, `SmartFillReview`, `SmartFillInline` in App.jsx (search `ASSET_INTEL_URL`). Server: edge function `asset-intelligence`.
- Plus and Pro only. The request carries the user's login token and only brand, model, item, category and barcode. Never send the install date, zip, tier or user id.
- The shared cache (`smart_fill_cache`, key `v2|brand|model`) must hold only facts true for every owner of a model. Never put owner-specific data in it.
- Smart Fill must never change an asset silently. Every suggestion is shown in a review the user ticks, anything that would replace the user's own entry starts unticked and is labeled, and an Undo is offered after applying.
- Daily limit is 40 lookups per user, enforced on the server (`smart_fill_usage` and the `smart_fill_usage_bump` function).

## PowerShell
- All PowerShell must be pure ASCII (no em dashes, curly quotes or other special characters).
- Never disable TLS verification or work around a proxy.

## Working style
- For anything non-trivial, state the plan first, then make the change.
- After a change, say what to test on the dev preview in two or three bullets.
- If a request conflicts with a rule above, say so and ask before proceeding.
