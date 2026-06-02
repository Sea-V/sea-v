#!/usr/bin/env node
/**
 * Phase 1 Supabase smoke test.
 * Run: node scripts/test-supabase.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const supabaseJs = fs.readFileSync(
    path.join(__dirname, "../js/supabase.js"),
    "utf8"
  );
  const urlMatch = supabaseJs.match(/supabaseUrl\s*=\s*"([^"]+)"/);
  const keyMatch = supabaseJs.match(/supabaseKey\s*=\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) {
    throw new Error("Could not read supabaseUrl/supabaseKey from js/supabase.js");
  }
  return { url: urlMatch[1], key: keyMatch[1] };
}

const TABLES = [
  "profile",
  "vessels",
  "seatimes",
  "certificates",
  "sea_references",
  "tenders",
  "achievements",
  "navigation_areas",
  "onboard_experiences",
  "hobbies_interests",
  "specialist_qualifications",
  "payslips"
];

async function restGet(config, table, query = "select=*&limit=1") {
  const endpoint = `${config.url}/rest/v1/${table}?${query}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json"
    }
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const config = loadConfig();
  console.log(`\nSEA-V Supabase smoke test`);
  console.log(`Project: ${config.url}\n`);

  const results = [];

  for (const table of TABLES) {
    const result = await restGet(config, table);
    const pass = result.ok;
    let detail = pass ? "OK" : JSON.stringify(result.body);

    if (table === "profile" && pass && Array.isArray(result.body)) {
      const row = result.body[0];
      if (!row) {
        detail = "Table reachable but no rows (run schema-phase1.sql)";
      } else if (row.id !== "default-profile") {
        detail = `Row found but id='${row.id}' (expected default-profile)`;
      } else {
        detail = `OK — default-profile row (public_enabled=${row.public_enabled})`;
      }
    } else if (pass && Array.isArray(result.body)) {
      detail = `OK — ${result.body.length} row(s) sampled`;
    }

    results.push({ table, pass, status: result.status, detail });
    console.log(`${pass ? "✓" : "✗"} ${table.padEnd(22)} ${result.status}  ${detail}`);
  }

  // Write test: touch updated_at only (do not overwrite user fields)
  const profileUpsert = await fetch(`${config.url}/rest/v1/profile`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      id: "default-profile",
      updated_at: new Date().toISOString()
    })
  }).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    body: await res.text()
  }));

  console.log(`\nWrite test (profile upsert):`);
  if (profileUpsert.ok) {
    console.log(`✓ profile upsert  ${profileUpsert.status}  OK — save from the app should work`);
  } else {
    console.log(`✗ profile upsert  ${profileUpsert.status}  ${profileUpsert.body.slice(0, 200)}`);
  }

  const storageProbe = await fetch(
    `${config.url}/storage/v1/object/onboard-experience-files/_smoke/${Date.now()}-probe.txt`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "text/plain",
        "x-upsert": "true"
      },
      body: "sea-v smoke test"
    }
  ).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    body: await res.text()
  }));

  const payslipStorageProbe = await fetch(
    `${config.url}/storage/v1/object/payslip-files/_smoke/${Date.now()}-probe.txt`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "text/plain",
        "x-upsert": "true"
      },
      body: "sea-v payslip smoke test"
    }
  ).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    body: await res.text()
  }));

  console.log(`\nStorage test (onboard-experience-files upload):`);
  if (storageProbe.ok) {
    console.log(`✓ onboard-experience-files  ${storageProbe.status}  OK — file uploads should work`);
  } else {
    console.log(
      `✗ onboard-experience-files  ${storageProbe.status}  ${storageProbe.body.slice(0, 200)}`
    );
    console.log("→ Run docs/onboard-experiences-table.sql (creates bucket + storage policies).");
  }

  console.log(`\nStorage test (payslip-files upload):`);
  if (payslipStorageProbe.ok) {
    console.log(`✓ payslip-files  ${payslipStorageProbe.status}  OK — payslip uploads should work`);
  } else {
    console.log(
      `✗ payslip-files  ${payslipStorageProbe.status}  ${payslipStorageProbe.body.slice(0, 200)}`
    );
    console.log("→ Run docs/payslips-table.sql (creates bucket + storage policies).");
  }

  const failed = results.filter((r) => !r.pass);
  const payslipsOk = results.find((r) => r.table === "payslips")?.pass;
  console.log("\n---");
  if (
    failed.length === 0 &&
    profileUpsert.ok &&
    storageProbe.ok &&
    (!payslipsOk || payslipStorageProbe.ok)
  ) {
    console.log("All table checks passed. Supabase looks aligned for Phase 1.");
  } else {
    console.log(`${failed.length} table(s) failed. Fix SQL/RLS in Supabase dashboard.`);
    if (failed.some((f) => f.table === "onboard_experiences")) {
      console.log("→ Run docs/onboard-experiences-table.sql if onboard_experiences is missing.");
    }
    if (failed.some((f) => f.table === "specialist_qualifications")) {
      console.log("→ Run docs/specialist-qualifications-table.sql if specialist_qualifications is missing.");
    }
    if (failed.some((f) => f.table === "payslips")) {
      console.log("→ Run docs/payslips-table.sql if payslips is missing.");
    }
    if (!storageProbe.ok) {
      console.log("→ Re-run docs/onboard-experiences-table.sql for onboard file uploads.");
    }
    if (payslipsOk && !payslipStorageProbe.ok) {
      console.log("→ Re-run docs/payslips-table.sql for payslip file uploads.");
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
