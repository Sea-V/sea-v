#!/usr/bin/env node
/**
 * Phase 2 Supabase smoke test.
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

const ANON_PRIVATE_TABLES = new Set(["tenders", "payslips"]);

const PUBLIC_TABLE_SAFE_COLUMNS = {
  profile: [
    "id", "user_id", "name", "rank", "qualification", "nationality", "dob", "location",
    "availability", "bio", "photo", "public_enabled", "created_at", "updated_at"
  ].join(","),
  vessels: [
    "id", "user_id", "name", "flag", "gt", "vessel_length", "builder", "vessel_role",
    "vessel_type", "program", "experience_onboard", "date_from", "date_to", "photo",
    "created_at", "updated_at"
  ].join(","),
  seatimes: [
    "id", "user_id", "vessel_id", "flag", "gt", "capacity_served", "date_joined",
    "date_left", "actual_sea_service_days", "standby_service_days", "yard_service_days",
    "watchkeeping_days", "verification_status", "created_at", "updated_at"
  ].join(","),
  certificates: [
    "id", "user_id", "code", "name", "expiry_date", "status", "attachment",
    "is_mandatory", "is_template", "created_at", "updated_at"
  ].join(","),
  sea_references: [
    "id", "user_id", "name", "title", "vessel_id", "role", "period", "reference_text",
    "reference_date", "status", "attachment", "verification", "created_at", "updated_at"
  ].join(","),
  achievements: [
    "id", "user_id", "code", "title", "category", "dashboard_section", "badge_key",
    "badge_file_name", "badge_tier", "badge_label", "badge_image", "badge_locked_image",
    "vessel_id", "vessel", "achievement_date", "status", "witness_name",
    "witness_position", "description", "attachment", "auto_awarded", "created_at", "updated_at"
  ].join(","),
  navigation_areas: [
    "id", "user_id", "country", "port", "from_country", "from_port", "from_lat",
    "from_lng", "to_country", "to_port", "to_lat", "to_lng", "vessel_id", "seatime_id",
    "operation_type", "passage_name", "visited_date", "departure_date", "arrival_date",
    "lat", "lng", "waypoints", "note", "created_at", "updated_at"
  ].join(","),
  onboard_experiences: [
    "id", "user_id", "vessel_id", "category", "title", "description", "location_onboard",
    "date_from", "date_to", "hours", "is_familiarisation", "status", "signoff",
    "attachment", "created_at", "updated_at"
  ].join(","),
  hobbies_interests: [
    "id", "user_id", "category", "title", "description", "date_from", "date_to",
    "status", "photos", "created_at", "updated_at"
  ].join(","),
  specialist_qualifications: [
    "id", "user_id", "category", "title", "issuing_body", "date_obtained", "expiry",
    "status", "notes", "attachment", "created_at", "updated_at"
  ].join(",")
};

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

async function storageUpload(config, bucket, objectPath, bodyText) {
  const res = await fetch(`${config.url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "text/plain",
      "x-upsert": "true"
    },
    body: bodyText
  });

  return {
    ok: res.ok,
    status: res.status,
    body: await res.text()
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function parseStepArg() {
  const arg = process.argv.find((item) => item.startsWith("--step"));
  if (!arg) return "all";
  const value = arg.includes("=") ? arg.split("=")[1] : process.argv[process.argv.indexOf(arg) + 1];
  return value || "all";
}

async function testTables(config) {
  const results = [];

  for (const table of TABLES) {
    let query = `select=${PUBLIC_TABLE_SAFE_COLUMNS[table] || "*"}&limit=1`;

    const result = await restGet(config, table, query);
    let pass = result.ok;
    let detail = pass ? "OK" : JSON.stringify(result.body);

    if (table === "profile" && pass && Array.isArray(result.body)) {
      const row = result.body[0];
      if (!row) {
        detail = "Table reachable (column grants active; no rows sampled)";
      } else if (row.id === "default-profile") {
        detail = "WARNING — still on demo profile (run schema-phase2.sql)";
      } else if (isUuid(row.id)) {
        detail = `OK — real user profile (public_enabled=${row.public_enabled})`;
      } else {
        detail = `OK — profile row id='${row.id}'`;
      }
    } else if (table === "profile" && !pass && result.status === 401) {
      pass = true;
      detail = "OK — profile protected by column grants (use safe column select in app)";
    } else if (!pass && result.status === 401 && ANON_PRIVATE_TABLES.has(table)) {
      pass = true;
      detail = "OK — table intentionally private to anon";
    } else if (!pass && result.status === 401 && PUBLIC_TABLE_SAFE_COLUMNS[table]) {
      pass = true;
      detail = "OK — no public rows readable under current RLS";
    } else if (pass && Array.isArray(result.body)) {
      detail = `OK — ${result.body.length} row(s) sampled`;
    }

    results.push({ table, pass, status: result.status, detail });
    console.log(`${pass ? "✓" : "✗"} ${table.padEnd(22)} ${result.status}  ${detail}`);
  }

  return results;
}

async function testPayslipAnonWrite(config) {
  const payslipInsert = await fetch(`${config.url}/rest/v1/payslips`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000099",
      tax_year: "2099-00",
      pay_period: "Smoke test",
      payment_date: "2099-01-01"
    })
  }).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    body: await res.text()
  }));

  console.log(`\nAnon write test (payslips insert must be blocked):`);
  if (!payslipInsert.ok) {
    console.log(
      `✓ payslips insert blocked  ${payslipInsert.status}  OK — payslip rows are owner-only`
    );
  } else {
    console.log(
      `✗ payslips insert allowed  ${payslipInsert.status}  FAIL — run docs/schema-phase2.sql`
    );
  }

  return !payslipInsert.ok;
}

async function testProfileWrite(config) {
  const profileUpsert = await fetch(`${config.url}/rest/v1/profile`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000099",
      updated_at: new Date().toISOString()
    })
  }).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    body: await res.text()
  }));

  console.log(`\nAnon write test (profile upsert must be blocked):`);
  if (!profileUpsert.ok) {
    console.log(
      `✓ profile upsert blocked  ${profileUpsert.status}  OK — RLS is protecting profile writes`
    );
  } else {
    console.log(
      `✗ profile upsert allowed  ${profileUpsert.status}  FAIL — run docs/schema-phase2.sql`
    );
  }

  return !profileUpsert.ok;
}

const PUBLIC_PROFILE_SAFE_COLUMNS = [
  "id",
  "user_id",
  "name",
  "rank",
  "qualification",
  "nationality",
  "dob",
  "location",
  "availability",
  "bio",
  "photo",
  "public_enabled",
  "created_at",
  "updated_at"
].join(",");

const PUBLIC_PROFILE_SENSITIVE_COLUMNS = ["email", "phone", "salary", "passports_held", "visas_held"];

async function testProfileColumns(config) {
  const safeProbe = await restGet(
    config,
    "profile",
    `select=${PUBLIC_PROFILE_SAFE_COLUMNS}&public_enabled=eq.true&limit=1`
  );
  const emailProbe = await restGet(config, "profile", "select=email&public_enabled=eq.true&limit=1");
  const wideProbe = await restGet(config, "profile", "select=*&public_enabled=eq.true&limit=1");

  console.log(`\nPublic profile column probe:`);

  let columnSafe = false;
  const safeOk = safeProbe.ok && Array.isArray(safeProbe.body);
  const emailBlocked = emailProbe.status === 401 || emailProbe.status === 403;
  const wideBlocked = wideProbe.status === 401 || wideProbe.status === 403;

  if (safeOk) {
    const row = safeProbe.body[0] || {};
    const leaked = PUBLIC_PROFILE_SENSITIVE_COLUMNS.filter((field) =>
      Object.prototype.hasOwnProperty.call(row, field)
    );

    if (!Object.keys(row).length) {
      console.log(`✓ safe columns readable  200  OK — no public profiles to probe yet`);
      columnSafe = emailBlocked;
    } else if (leaked.length) {
      console.log(`✗ sensitive fields in safe select  ${leaked.join(", ")}  FAIL`);
    } else {
      console.log(`✓ safe columns readable  200  OK — public profile fields load correctly`);
      columnSafe = emailBlocked;
    }
  } else {
    console.log(
      `✗ safe column probe  ${safeProbe.status}  ${JSON.stringify(safeProbe.body).slice(0, 160)}`
    );
    console.log("→ Run docs/hardening-steps/step1-profile-columns.sql");
  }

  if (emailBlocked) {
    console.log(`✓ email column blocked  ${emailProbe.status}  OK — sensitive columns denied`);
    columnSafe = columnSafe && safeOk;
  } else {
    console.log(`✗ email column readable  ${emailProbe.status}  FAIL — run step1-profile-columns.sql`);
    columnSafe = false;
  }

  if (wideBlocked) {
    console.log(`✓ select=* blocked  ${wideProbe.status}  OK — wildcard select denied (column grants active)`);
  } else if (safeOk) {
    console.log(`⚠ select=* still works  ${wideProbe.status}  — column grants may not be applied`);
  }

  return columnSafe;
}

async function testStorageUploads(config) {
  const storageProbe = await storageUpload(
    config,
    "onboard-experience-files",
    `_smoke/${Date.now()}-probe.txt`,
    "sea-v smoke test"
  );

  const payslipStorageProbe = await storageUpload(
    config,
    "payslip-files",
    `_smoke/${Date.now()}-probe.txt`,
    "sea-v payslip smoke test"
  );

  console.log(`\nAnon storage upload test (must be blocked after hardening):`);
  if (!storageProbe.ok) {
    console.log(
      `✓ onboard-experience-files blocked  ${storageProbe.status}  OK — anon cannot upload files`
    );
  } else {
    console.log(
      `✗ onboard-experience-files allowed  ${storageProbe.status}  FAIL — run docs/hardening-steps/step3-storage-private.sql`
    );
  }

  if (!payslipStorageProbe.ok) {
    console.log(`✓ payslip-files blocked  ${payslipStorageProbe.status}  OK — payslip bucket is private`);
  } else {
    console.log(
      `✗ payslip-files allowed  ${payslipStorageProbe.status}  FAIL — run docs/hardening-steps/step3-storage-private.sql`
    );
  }

  return !storageProbe.ok && !payslipStorageProbe.ok;
}

const STEP_HELP = {
  0: "Baseline — tables + existing RLS",
  1: "After step1-profile-columns.sql",
  2: "After step2-status-rls.sql",
  3: "After step3-storage-private.sql",
  4: "After step4-storage-public-read.sql",
  all: "Full security check"
};

async function main() {
  const step = parseStepArg();
  const config = loadConfig();

  console.log(`\nSEA-V Supabase smoke test (Phase 2)`);
  console.log(`Project: ${config.url}`);
  console.log(`Step: ${step} — ${STEP_HELP[step] || STEP_HELP.all}\n`);

  let failedTables = [];
  let profileWriteBlocked = true;
  let payslipWriteBlocked = true;
  let columnSafe = false;
  let storageBlocked = false;

  if (step === "0" || step === "all") {
    failedTables = (await testTables(config)).filter((r) => !r.pass);
    profileWriteBlocked = await testProfileWrite(config);
    payslipWriteBlocked = await testPayslipAnonWrite(config);
  }

  if (step === "1" || step === "all") {
    if (step === "1") console.log("(Skipping table scan — run with --step 0 or --step all for full scan)\n");
    columnSafe = await testProfileColumns(config);
  }

  if (step === "2") {
    console.log("Step 2 is SQL-only (RLS policy changes).");
    console.log("No automated probe — verify public profile still loads in incognito after step 2.\n");
  }

  if (step === "3" || step === "all") {
    storageBlocked = await testStorageUploads(config);
  }

  if (step === "4") {
    console.log("Step 4 restores anon READ on storage for public profiles.");
    console.log("Anon uploads should still be blocked. Re-run: node scripts/test-supabase.mjs --step 3\n");
    storageBlocked = await testStorageUploads(config);
  }

  console.log("---");
  let passed = true;
  if (step === "0") {
    passed = failedTables.length === 0 && profileWriteBlocked && payslipWriteBlocked;
    console.log(failedTables.length ? `${failedTables.length} table(s) failed.` : "Tables reachable.");
    console.log(profileWriteBlocked ? "Profile writes blocked (good)." : "Profile writes NOT blocked — run schema-phase2.sql");
    console.log(payslipWriteBlocked ? "Payslip writes blocked (good)." : "Payslip writes NOT blocked — run schema-phase2.sql");
    console.log("Next: run docs/hardening-steps/step1-profile-columns.sql in Supabase, then --step 1");
  } else if (step === "1") {
    passed = columnSafe;
    console.log(columnSafe ? "Step 1 passed." : "Step 1 not passed yet — run step1-profile-columns.sql");
    console.log("Next: run docs/hardening-steps/step2-status-rls.sql, then --step 2");
  } else if (step === "2") {
    passed = true;
    console.log("Step 2 applied in SQL Editor?");
    console.log("Next: run docs/hardening-steps/step3-storage-private.sql, then --step 3");
  } else if (step === "3") {
    passed = storageBlocked;
    console.log(storageBlocked ? "Step 3 passed — anon uploads blocked." : "Step 3 not passed yet — run step3b-drop-legacy-storage-policies.sql");
    console.log("Next: run docs/hardening-steps/step4-storage-public-read.sql, then --step 4");
  } else if (step === "4") {
    passed = storageBlocked;
    console.log(storageBlocked ? "Anon uploads still blocked (good)." : "Storage still open — re-run step 3");
    console.log("Done. Run: node scripts/test-supabase.mjs --step all");
  } else if (
    failedTables.length === 0 &&
    profileWriteBlocked &&
    payslipWriteBlocked &&
    storageBlocked &&
    columnSafe
  ) {
    passed = true;
    console.log("All Phase 2 security checks passed.");
  } else {
    passed = false;
    if (failedTables.length) {
      console.log(`${failedTables.length} table(s) unreachable. Run docs/schema-full.sql first.`);
    }
    if (!profileWriteBlocked) {
      console.log("→ Run docs/schema-phase2.sql for per-user RLS.");
    }
    if (!payslipWriteBlocked) {
      console.log("→ Payslip writes are open to anon — run docs/schema-phase2.sql.");
    }
    if (!storageBlocked) {
      console.log("→ Run docs/hardening-steps/step3-storage-private.sql");
    }
    if (!columnSafe) {
      console.log("→ Run docs/hardening-steps/step1-profile-columns.sql");
    }
  }
  console.log("");
  if (!passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
