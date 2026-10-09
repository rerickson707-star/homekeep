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

const due = guidesDueForReview();
if (due.length) {
  console.warn("\nREVIEW DUE:");
  for (const g of due) console.warn("  - " + g.shortName + " (review by " + g.reviewBy + "): " + g.reviewNotes.join(" | "));
}
