// Checks the guide registry. Run before every commit that touches src/guides-registry.js:
//   node scripts/check-guides.mjs
// Exit code 1 if the registry has a problem. Guides past their review date are listed as a warning.
import { GUIDES, GUIDE_PRICES, validateRegistry, guidesDueForReview, guidePagePaths, bundleFor } from "../src/guides-registry.js";

const problems = validateRegistry();
if (problems.length) {
  console.error("Registry problems:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log("Registry OK: " + GUIDES.length + " guides");
console.log("Pages (prerender and sitemap): " + ["/guides", ...guidePagePaths()].join(", "));
for (const g of GUIDES.filter((x) => x.kind === "county")) {
  const b = bundleFor(g.id);
  if (b) console.log("Bundle " + b.state.shortName + " + " + b.county.shortName + ": $" + b.price + " (separate $" + b.separate + ", saves $" + b.saves + ")");
}
console.log("Prices: state $" + GUIDE_PRICES.state + ", county $" + GUIDE_PRICES.county + ", bundle $" + GUIDE_PRICES.bundle);

// The guide-preview edge function keeps its own copy of the guide ids, preview files, consent wording
// and answer codes. Fail if the copy has drifted from the registry (skipped if the file is not in the repo).
import fs from "node:fs";
import { GUIDE_CONSENT_VERSION, GUIDE_CONSENT_TEXT, GUIDE_LEAD_OPTIONS } from "../src/guides-registry.js";
const fnPath = "supabase/functions/guide-preview/index.ts";
if (fs.existsSync(fnPath)) {
  const src = fs.readFileSync(fnPath, "utf8");
  const drift = [];
  for (const g of GUIDES) {
    if (!src.includes('"' + g.id + '"')) drift.push("guide id " + g.id + " missing in " + fnPath);
    if (g.preview && !src.includes(g.preview.storageKey)) drift.push("preview " + g.preview.storageKey + " missing in " + fnPath);
  }
  if (!src.includes('"' + GUIDE_CONSENT_VERSION + '"') || !src.includes(GUIDE_CONSENT_TEXT)) drift.push("consent version or wording differs in " + fnPath);
  for (const list of Object.values(GUIDE_LEAD_OPTIONS)) for (const o of list) if (!src.includes('"' + o.code + '"')) drift.push("answer code " + o.code + " missing in " + fnPath);
  for (const k of ["state", "county", "bundle"]) if (!src.includes('"' + GUIDE_PRICES[k].toFixed(2) + '"')) drift.push("price " + k + " $" + GUIDE_PRICES[k].toFixed(2) + " missing in " + fnPath);
  for (const g of GUIDES) { const m = src.match(new RegExp(JSON.stringify(g.id).slice(1, -1) + '"[^]*?pages: (\\d+)')); if (!m || Number(m[1]) !== g.pages) drift.push("page count for " + g.id + " differs in " + fnPath); }
  if (drift.length) { console.error("Edge function out of step with the registry:"); for (const d of drift) console.error("  - " + d); process.exit(1); }
  console.log("Edge function matches the registry");
} else {
  console.log("(skipped edge function check: " + fnPath + " not in this repo)");
}

// Every page image named in the registry must exist in public/guide-img/ (a missing file is a broken picture).
for (const g of GUIDES) for (const x of [g.images.cover, ...g.images.pages]) {
  if (!fs.existsSync("public" + x.src)) { console.error("Missing image file: public" + x.src + " (" + g.shortName + ")"); process.exit(1); }
}
console.log("Guide images present");

const due = guidesDueForReview();
if (due.length) {
  console.warn("\nREVIEW DUE:");
  for (const g of due) console.warn("  - " + g.shortName + " (review by " + g.reviewBy + "): " + g.reviewNotes.join(" | "));
}
