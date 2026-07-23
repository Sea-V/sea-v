#!/usr/bin/env node
/** Patch HTML pages with consistent script load order. Run: node scripts/patch-html-scripts.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Keep in sync with SeavConfig.ASSET_VERSION in js/seav-config.js */
const ASSET_VERSION = 202;

function bumpAssetVersions(html) {
  // "\/?" before styles.css|js/ handles public-profile.html, which uses
  // root-absolute paths (/styles.css, /js/x.js) instead of the usual
  // relative ones — it's also served at /u/<username> via a Netlify/Vercel
  // rewrite, where a relative path would resolve against "/u/" and 404.
  let next = html.replace(
    /((?:href|src)="\/?(?:styles\.css|js\/[^"?]+))\?v=\d+/g,
    `$1?v=${ASSET_VERSION}`
  );
  next = next.replace(
    /((?:href|src)="\/?(styles\.css|js\/[^"]+\.js))(?!\?v=)/g,
    `$1?v=${ASSET_VERSION}`
  );
  return next;
}

/**
 * styles.css pulls in every css/**.css file via @import. Each @import is its
 * own HTTP request with its own cache key, so bumping ?v= on the <link> tag
 * in HTML does NOT bust the cache of the files it @imports — only this does.
 * Several past bugs ("colors not showing after deploy") were worked around by
 * embedding CSS directly in styles.css instead of fixing this; keep every
 * @import on the same ASSET_VERSION so that workaround is never needed again.
 */
function bumpCssImports(css) {
  return css.replace(
    /@import url\("([^"?]+)(?:\?v=\d+)?"\);/g,
    `@import url("$1?v=${ASSET_VERSION}");`
  );
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

  if (next.includes("js/dashboard-snippets.js") && !next.includes("js/seav-cards.js")) {
    next = next.replace(
      '<script src="js/dashboard-snippets.js',
      '<script src="js/seav-cards.js" defer></script>\n  <script src="js/dashboard-snippets.js'
    );
  }

  /**
   * The dashboard's navigation card needs the same routed sea-lane distance
   * calculation navigation.html uses (js/navigation-passage.js's getEntryRoute),
   * so its "Total distance" figure matches instead of a separate straight-line
   * estimate. These modules are self-contained (no map/DOM dependency) so they
   * are safe to load on the dashboard purely for the distance math.
   */
  if (next.includes("js/dashboard-snippets.js") && !next.includes("js/navigation-passage.js")) {
    next = next.replace(
      '<script src="js/dashboard-snippets.js',
      '<script src="js/navigation-ports.js" defer></script>\n  <script src="js/navigation-helpers.js" defer></script>\n  <script src="js/navigation-passage.js" defer></script>\n  <script src="js/navigation-routing.js" defer></script>\n  <script src="js/dashboard-snippets.js'
    );
  }

  if (next.includes('src="js/core.js"') && !next.includes("js/seav-upload.js")) {
    next = next.replace(
      '<script src="js/core.js" defer></script>',
      `<script src="js/core.js" defer></script>\n  <script src="js/seav-upload.js" defer></script>`
    );
  }

  // heic2any: client-side HEIC -> JPEG conversion so iPhone photos render in
  // Chrome/Firefox/Edge (only Safari decodes HEIC natively). Loaded right
  // before seav-upload.js, the single choke point every photo upload goes
  // through. Separate idempotent check so it also backfills pages that
  // already had seav-upload.js inserted by an earlier run of this script.
  // Matches only the opening of the tag (not the full closing/version suffix)
  // since re-runs see the tag with ?v=N already appended from bumpAssetVersions.
  if (next.includes("js/seav-upload.js") && !next.includes("heic2any")) {
    next = next.replace(
      '<script src="js/seav-upload.js',
      `<script src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js" defer></script>\n  <script src="js/seav-upload.js`
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

  // Share cards: html2canvas rasterizes the off-screen card js/seav-share.js
  // builds, then hands the PNG to navigator.share (or a download fallback).
  // Inserted right after badge-unlock.js since that's the only current
  // trigger (the "Share this badge" button in the unlock celebration); any
  // page that shows that celebration needs both loaded too.
  if (next.includes("js/badge-unlock.js") && !next.includes("js/seav-share.js")) {
    next = next.replace(
      /<script src="js\/badge-unlock\.js([^"]*)" defer><\/script>/,
      `<script src="js/badge-unlock.js$1" defer></script>\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>\n  <script src="js/seav-share.js$1" defer></script>`
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
      `<script src="js/seav-cards.js" defer></script>\n  <script src="js/public-profile-utils.js" defer></script>\n  <script src="js/public-profile-sections.js" defer></script>\n  <script src="js/public-profile.js`
    );
  }

  if (next.includes("js/public-profile-sections.js") && !next.includes("js/seav-cards.js")) {
    next = next.replace(
      '<script src="js/public-profile-sections.js',
      '<script src="js/seav-cards.js" defer></script>\n  <script src="js/public-profile-sections.js'
    );
  }

  // Same reasoning as the dashboard: give the public profile's navigation
  // stats access to the routed sea-lane distance calc, not just haversine.
  if (next.includes("js/public-profile-utils.js") && !next.includes("js/navigation-passage.js")) {
    next = next.replace(
      '<script src="js/public-profile-utils.js',
      '<script src="js/navigation-helpers.js" defer></script>\n  <script src="js/navigation-passage.js" defer></script>\n  <script src="js/navigation-routing.js" defer></script>\n  <script src="js/public-profile-utils.js'
    );
  }

  return bumpAssetVersions(next);
}

const PUBLIC_PAGES = [
  "verify-reference.html",
  "confirm-account.html",
  "reset-password.html",
  "index.html",
  "signup.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "terms.html"
];

let changed = 0;

const stylesPath = path.join(root, "styles.css");
const stylesOriginal = fs.readFileSync(stylesPath, "utf8");
const stylesPatched = bumpCssImports(stylesOriginal);
if (stylesPatched !== stylesOriginal) {
  fs.writeFileSync(stylesPath, stylesPatched);
  changed += 1;
  console.log("patched styles.css (@import versions)");
}

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

for (const file of PUBLIC_PAGES) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;
  const original = fs.readFileSync(filePath, "utf8");
  const patched = bumpAssetVersions(original);
  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
    changed += 1;
    console.log("patched", file);
  }
}

console.log(changed ? `Updated ${changed} file(s).` : "All HTML files already up to date.");
