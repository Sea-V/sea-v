#!/usr/bin/env node
/** Patch HTML pages with consistent script load order. Run: node scripts/patch-html-scripts.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Keep in sync with SeavConfig.ASSET_VERSION in js/seav-config.js */
const ASSET_VERSION = 44;

function bumpAssetVersions(html) {
  let next = html.replace(
    /((?:href|src)="(?:styles\.css|js\/[^"?]+))\?v=\d+/g,
    `$1?v=${ASSET_VERSION}`
  );
  next = next.replace(
    /((?:href|src)="(styles\.css|js\/[^"]+\.js))(?!\?v=)/g,
    `$1?v=${ASSET_VERSION}`
  );
  return next;
}

const APP_PAGES = [
  "dashboard.html",
  "profile.html",
  "cv-generator.html",
  "vessels.html",
  "seatime.html",
  "certificates.html",
  "references.html",
  "achievements.html",
  "tenders.html",
  "navigation.html",
  "onboard-experience.html",
  "hobbies-interests.html",
  "specialist-qualifications.html",
  "payslips.html"
];

function patchAppPage(html) {
  let next = html;

  if (!next.includes("js/seav-config.js")) {
    next = next.replace(
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
      `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="js/seav-config.js"></script>`
    );
  }

  if (next.includes('src="js/api.js"') && !next.includes("js/api-core.js")) {
    next = next.replace(
      '<script src="js/api.js" defer></script>',
      `<script src="js/api-core.js" defer></script>\n  <script src="js/api-mappers.js" defer></script>\n  <script src="js/api.js" defer></script>`
    );
  }

  if (next.includes("js/dashboard.js") && !next.includes("js/dashboard-snippets.js")) {
    next = next.replace(
      '<script src="js/dashboard.js',
      '<script src="js/dashboard-snippets.js" defer></script>\n  <script src="js/dashboard.js'
    );
  }

  if (next.includes('src="js/core.js"') && !next.includes("js/seav-upload.js")) {
    next = next.replace(
      '<script src="js/core.js" defer></script>',
      `<script src="js/core.js" defer></script>\n  <script src="js/seav-upload.js" defer></script>`
    );
  }

  if (next.includes("js/certificates.js") && !next.includes("js/certificates-export.js")) {
    next = next.replace(
      /<script src="js\/certificates\.js([^"]*)" defer><\/script>/,
      `<script src="js/certificates.js$1" defer></script>\n  <script src="js/certificates-export.js$1" defer></script>`
    );
  }

  if (next.includes("js/navigation.js") && !next.includes("js/navigation-helpers.js")) {
    next = next.replace(
      '<script src="js/navigation-ports.js',
      `<script src="js/navigation-helpers.js" defer></script>\n  <script src="js/navigation-passage.js" defer></script>\n  <script src="js/navigation-ports.js`
    );
  }

  if (next.includes("js/navigation.js") && !next.includes("js/navigation-state.js")) {
    next = next.replace(
      /<script src="js\/navigation\.js([^"]*)" defer><\/script>/,
      `<script src="js/navigation-state.js" defer></script>\n  <script src="js/navigation-map.js" defer></script>\n  <script src="js/navigation-form.js" defer></script>\n  <script src="js/navigation-list.js" defer></script>\n  <script src="js/navigation.js$1" defer></script>`
    );
  }

  if (next.includes("js/payslips.js") && !next.includes("js/payslips-core.js")) {
    next = next.replace(
      '<script src="js/payslips.js" defer></script>',
      `<script src="js/payslips-core.js" defer></script>\n  <script src="js/payslips-render.js" defer></script>\n  <script src="js/payslips-export.js" defer></script>\n  <script src="js/payslips.js" defer></script>`
    );
  }

  if (next.includes("js/cv-engine.js") && !next.includes("js/cv-engine-model.js")) {
    next = next.replace(
      '<script src="js/cv-engine.js" defer></script>',
      `<script src="js/cv-engine-model.js" defer></script>\n  <script src="js/cv-engine-render.js" defer></script>\n  <script src="js/cv-engine.js" defer></script>`
    );
  }

  return next;
}

function finalizeAppPage(html) {
  return bumpAssetVersions(patchAppPage(html));
}

function patchPublicProfile(html) {
  let next = patchAppPage(html);

  if (!next.includes("js/public-profile-utils.js")) {
    next = next.replace(
      '<script src="js/public-profile.js',
      `<script src="js/public-profile-utils.js" defer></script>\n  <script src="js/public-profile-sections.js" defer></script>\n  <script src="js/public-profile.js`
    );
  }

  return bumpAssetVersions(next);
}

let changed = 0;

for (const file of APP_PAGES) {
  const filePath = path.join(root, file);
  const original = fs.readFileSync(filePath, "utf8");
  const patched = finalizeAppPage(original);
  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
    changed += 1;
    console.log("patched", file);
  }
}

const ppPath = path.join(root, "public-profile.html");
const ppOriginal = fs.readFileSync(ppPath, "utf8");
const ppPatched = patchPublicProfile(ppOriginal);
if (ppPatched !== ppOriginal) {
  fs.writeFileSync(ppPath, ppPatched);
  changed += 1;
  console.log("patched public-profile.html");
}

console.log(changed ? `Updated ${changed} file(s).` : "All HTML files already up to date.");
