#!/usr/bin/env node
/**
 * Injects Vercel Speed Insights script tag into all root HTML pages.
 * Run: node scripts/inject-speed-insights.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = 'type="module" src="js/speed-insights.js"';

// Speed Insights should be loaded early in the head, after Sentry but before other scripts
const speedInsightsScript = `
  <!-- Vercel Speed Insights — tracks Core Web Vitals and performance metrics.
       Loaded as ES module to use the @vercel/speed-insights package.
       See: https://vercel.com/docs/speed-insights -->
  <script type="module" src="js/speed-insights.js"></script>
`;

const htmlFiles = fs
  .readdirSync(root)
  .filter((name) => name.endsWith(".html"))
  .sort();

let updated = 0;

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  let html = fs.readFileSync(filePath, "utf8");

  // Skip if already injected
  if (html.includes(marker)) {
    continue;
  }

  // Find the charset meta tag and insert after it
  const charsetMatch = html.match(/(<meta\s+charset="[^"]+"\s*\/?>)/i);

  if (!charsetMatch) {
    console.warn(`skip ${file}: no charset meta`);
    continue;
  }

  html = html.replace(charsetMatch[0], `${charsetMatch[0]}${speedInsightsScript}`);
  fs.writeFileSync(filePath, html);
  updated += 1;
  console.log(`updated ${file}`);
}

console.log(`done — ${updated} file(s) updated`);
