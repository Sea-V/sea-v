#!/usr/bin/env node
/**
 * Inserts shared favicon / theme-color tags after the viewport meta on every root HTML page.
 * Run: node scripts/inject-seo-head.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = 'rel="icon" href="/favicon.ico"';

const seoBlock = `
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="48x48" href="/img/favicon-48.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="/img/favicon-96.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png" />
  <meta name="theme-color" content="#071019" />
`;

const htmlFiles = fs
  .readdirSync(root)
  .filter((name) => name.endsWith(".html"))
  .sort();

let updated = 0;

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  let html = fs.readFileSync(filePath, "utf8");

  if (html.includes(marker)) {
    continue;
  }

  const viewportMatch = html.match(
    /(<meta\s+name="viewport"\s+content="[^"]+"\s*\/?>)/i
  );

  if (!viewportMatch) {
    console.warn(`skip ${file}: no viewport meta`);
    continue;
  }

  html = html.replace(viewportMatch[0], `${viewportMatch[0]}${seoBlock}`);
  fs.writeFileSync(filePath, html);
  updated += 1;
  console.log(`updated ${file}`);
}

console.log(`done — ${updated} file(s) updated`);
