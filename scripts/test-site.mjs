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
  "achievements.html",
  "tenders.html",
  "navigation.html",
  "onboard-experience.html",
  "hobbies-interests.html",
  "specialist-qualifications.html",
  "payslips.html"
];

const REQUIRED_ASSETS = ["img/logo.png", "styles.css", "js/auth.js", "js/core.js"];

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

  console.log(`\nHTTP checks (${baseUrl}):`);
  const httpChecks = await Promise.all(PAGES.map(checkHttp));
  for (const check of httpChecks) {
    console.log(`${check.pass ? "✓" : "✗"} ${check.page.padEnd(28)} ${check.status}  ${check.detail}`);
  }

  const failedFiles = fileChecks.filter((c) => !c.pass);
  const failedHttp = httpChecks.filter((c) => !c.pass);

  console.log("\n---");
  if (!failedFiles.length && !failedHttp.length) {
    console.log("All static checks passed.");
  } else {
    if (failedFiles.length) console.log(`${failedFiles.length} local file check(s) failed.`);
    if (failedHttp.length) console.log(`${failedHttp.length} HTTP check(s) failed.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
