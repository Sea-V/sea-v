#!/usr/bin/env node
/**
 * Static site checks for SEA-V.
 * Run: node scripts/test-site.mjs [baseUrl]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const baseUrl = process.argv[2] || "http://127.0.0.1:8765";
const skipHttpChecks =
  process.env.SKIP_HTTP_CHECKS === "1" ||
  process.env.CI === "true" ||
  process.env.GITHUB_ACTIONS === "true";

const PAGES = [
  "index.html",
  "signup.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  "dashboard.html",
  "profile.html",
  "public-profile.html",
  "cv-generator.html",
  "vessels.html",
  "seatime.html",
  "certificates.html",
  "references.html",
  "verify-reference.html",
  "achievements.html",
  "tenders.html",
  "navigation.html",
  "onboard-experience.html",
  "hobbies-interests.html",
  "specialist-qualifications.html",
  "payslips.html"
];

const REQUIRED_ASSETS = [
  "img/logo.png",
  "styles.css",
  "js/seav-config.js",
  "js/seav-upload.js",
  "js/auth.js",
  "js/core.js",
  "js/api-core.js",
  "js/api-mappers.js",
  "js/api.js",
  "js/certificates.js",
  "js/navigation-helpers.js",
  "js/navigation-state.js",
  "js/payslips-core.js",
  "js/cv-engine-model.js"
];

const SCRIPT_CHAINS = {
  "navigation.html": [
    "js/navigation-state.js",
    "js/navigation-map.js",
    "js/navigation-form.js",
    "js/navigation-list.js",
    "js/navigation.js"
  ],
  "payslips.html": [
    "js/payslips-core.js",
    "js/payslips-render.js",
    "js/payslips-export.js",
    "js/payslips.js"
  ],
  "cv-generator.html": [
    "js/cv-engine-model.js",
    "js/cv-engine-render.js",
    "js/cv-engine.js"
  ],
  "public-profile.html": [
    "js/seav-data.js",
    "js/api.js",
    "js/public-profile-utils.js",
    "js/public-profile-sections.js",
    "js/public-profile.js"
  ]
};

function checkScriptOrder(page, scripts) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  let lastIdx = -1;
  for (const src of scripts) {
    const idx = html.indexOf(src);
    if (idx === -1) {
      return { page, pass: false, detail: `missing ${src}` };
    }
    if (idx < lastIdx) {
      return { page, pass: false, detail: `wrong order before ${src}` };
    }
    lastIdx = idx;
  }
  return { page, pass: true, detail: "script order OK" };
}

function checkFile(relativePath) {
  const full = path.join(root, relativePath);
  const exists = fs.existsSync(full);
  let detail = exists ? "OK" : "MISSING";

  if (exists) {
    const stat = fs.statSync(full);
    if (relativePath === "img/logo.png") {
      const kb = Math.round(stat.size / 1024);
      detail = `OK (${kb} KB)`;
      if (stat.size > 500_000) {
        detail += " — consider compressing (target under 500 KB)";
      }
    }
  }

  return { relativePath, pass: exists, detail };
}

async function checkHttp(page) {
  const url = `${baseUrl}/${page}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    const hasLogo = /img\/logo\.png/.test(text);
    const hasAuth = /js\/auth\.js/.test(text) || ![
      "dashboard.html",
      "profile.html",
      "vessels.html"
    ].includes(page)
      ? true
      : /js\/auth\.js/.test(text);

    return {
      page,
      pass: res.ok,
      status: res.status,
      detail: res.ok
        ? `OK${page === "index.html" && !hasLogo ? " — logo ref missing" : ""}`
        : "HTTP error"
    };
  } catch (err) {
    return {
      page,
      pass: false,
      status: 0,
      detail: `Cannot reach ${baseUrl} (${err.message}). Start: python3 -m http.server 8765`
    };
  }
}

async function main() {
  console.log("\nSEA-V static site checks\n");

  console.log("Local files:");
  const fileChecks = [...REQUIRED_ASSETS, ...PAGES.map((p) => p)].map(checkFile);
  for (const check of fileChecks) {
    console.log(`${check.pass ? "✓" : "✗"} ${check.relativePath.padEnd(28)} ${check.detail}`);
  }

  console.log("\nSplit module script order:");
  const chainChecks = Object.entries(SCRIPT_CHAINS).map(([page, scripts]) =>
    checkScriptOrder(page, scripts)
  );
  for (const check of chainChecks) {
    console.log(`${check.pass ? "✓" : "✗"} ${check.page.padEnd(28)} ${check.detail}`);
  }

  let httpChecks = [];
  if (skipHttpChecks) {
    console.log("\nHTTP checks: skipped (CI / SKIP_HTTP_CHECKS)");
  } else {
    console.log(`\nHTTP checks (${baseUrl}):`);
    httpChecks = await Promise.all(PAGES.map(checkHttp));
    for (const check of httpChecks) {
      console.log(`${check.pass ? "✓" : "✗"} ${check.page.padEnd(28)} ${check.status}  ${check.detail}`);
    }
  }

  const failedFiles = fileChecks.filter((c) => !c.pass);
  const failedChains = chainChecks.filter((c) => !c.pass);
  const failedHttp = httpChecks.filter((c) => !c.pass);

  console.log("\n---");
  if (!failedFiles.length && !failedChains.length && !failedHttp.length) {
    console.log("All static checks passed.");
  } else {
    if (failedFiles.length) console.log(`${failedFiles.length} local file check(s) failed.`);
    if (failedChains.length) console.log(`${failedChains.length} script order check(s) failed.`);
    if (failedHttp.length) console.log(`${failedHttp.length} HTTP check(s) failed.`);
    process.exit(1);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
