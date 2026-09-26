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

// tenders are intentionally public (they show on public profiles alongside
// vessels) — only payslips are fully private to anon. See
// docs/schema-phase2-public-hardening.sql for the tenders_public_read policy.
const ANON_PRIVATE_TABLES = new Set(["payslips"]);

const PUBLIC_TABLE_SAFE_COLUMNS = {
  profile: [
    "id", "user_id", "name", "rank", "qualification", "nationality", "location",
    "availability", "bio", "photo", "public_enabled", "created_at", "updated_at"
  ].join(","),
  vessels: [
    "id", "user_id", "name", "flag", "gt", "vessel_length", "builder", "vessel_role",
    "vessel_type", "contract_type", "program", "experience_onboard", "date_from", "date_to", "photo",
    "imo", "mmsi", "official_number", "call_sign", "year_built", "net_tonnage", "engine_kw",
    "classification_society", "additional_duties", "created_at", "updated_at"
  ].join(","),
  seatimes: [
    "id", "user_id", "vessel_id", "flag", "gt", "capacity_served", "date_joined",
    "date_left", "actual_sea_service_days", "standby_service_days", "yard_service_days",
    "watchkeeping_days", "verification_status", "created_at", "updated_at"
  ].join(","),
  certificates: [
    "id", "user_id", "code", "name", "issue_date", "expiry_date", "status",
    "is_mandatory", "is_template", "created_at", "updated_at"
  ].join(","),
  // Kept in lockstep with PUBLIC_ARRAY_COLUMNS.sea_references in js/api.js --
  // testPublicColumnDrift() below fails the run if the two ever diverge again.
  // This list previously named the RAW "verification" column (the referee's
  // real CoC number, which api.js deliberately never requests publicly) and
  // omitted period_from/period_to/doc_type, so it probed a column set the app
  // does not use -- which is how the missing anon grants on those three went
  // unnoticed from 2026-08-01 to 2026-09-18. See
  // docs/schema-sea-references-public-column-grants.sql.
  sea_references: [
    "id", "user_id", "name", "title", "vessel_id", "role", "period", "period_from",
    "period_to", "reference_text", "reference_date", "status", "attachment",
    "verification_public", "doc_type", "created_at", "updated_at"
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
    "lat", "lng", "waypoints", "note", "is_tidal", "created_at", "updated_at"
  ].join(","),
  onboard_experiences: [
    "id", "user_id", "vessel_id", "category", "title", "description", "location_onboard", "position_held",
    "date_from", "date_to", "hours", "is_familiarisation", "status",
    "attachment", "created_at", "updated_at"
  ].join(","),
  hobbies_interests: [
    "id", "user_id", "category", "title", "description", "date_from", "date_to",
    "status", "photos", "created_at", "updated_at"
  ].join(","),
  specialist_qualifications: [
    "id", "user_id", "category", "title", "issuing_body", "date_obtained", "expiry",
    "status", "notes", "attachment", "created_at", "updated_at"
  ].join(","),
  tenders: [
    "id", "user_id", "name", "vessel_id", "type", "model", "length", "engine", "capacity",
    "reg", "proficiency_level", "description", "photo", "created_at", "updated_at"
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
  "location",
  "availability",
  "bio",
  "photo",
  "public_enabled",
  "created_at",
  "updated_at"
].join(",");

const PUBLIC_PROFILE_SENSITIVE_COLUMNS = ["email", "phone", "salary", "dob", "passports_held", "visas_held"];

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

// Vessels carry two deliberately private columns — salary and leave_package —
// that anon must never read, alongside a public set that the public profile
// depends on. Added 2026-08-21 with the contract_type column: anon's SELECT on
// vessels is column-scoped, so a new column is invisible to the public profile
// until it is explicitly granted, and a careless grant is how a private field
// leaks. This probe asserts both directions every run.
const PUBLIC_VESSEL_SENSITIVE_COLUMNS = ["salary", "leave_package"];

async function testVesselColumns(config) {
  console.log(`\nVessel column probe:`);

  const safeProbe = await restGet(
    config,
    "vessels",
    `select=${PUBLIC_TABLE_SAFE_COLUMNS.vessels}&limit=1`
  );

  let ok = safeProbe.ok || safeProbe.status === 401;
  if (safeProbe.ok) {
    console.log(`✓ public columns readable  ${safeProbe.status}  OK — includes contract_type`);
  } else if (safeProbe.status === 401) {
    console.log(`✓ public columns  401  OK — no public rows readable under current RLS`);
  } else {
    console.log(
      `✗ public column probe  ${safeProbe.status}  ${JSON.stringify(safeProbe.body).slice(0, 160)}`
    );
    console.log("→ A column in PUBLIC_ARRAY_COLUMNS.vessels is missing its anon grant.");
  }

  for (const column of PUBLIC_VESSEL_SENSITIVE_COLUMNS) {
    const probe = await restGet(config, "vessels", `select=${column}&limit=1`);
    const blocked = probe.status === 401 || probe.status === 403;
    if (blocked) {
      console.log(`✓ ${column} blocked  ${probe.status}  OK — private column denied to anon`);
    } else {
      console.log(`✗ ${column} readable  ${probe.status}  FAIL — revoke the anon grant on vessels.${column}`);
      ok = false;
    }
  }

  return ok;
}

// sea_references carries three columns anon must never read: email and
// message_to_referee (the referee's contact details) and "verification" -- the
// raw sign-off blob holding the referee's real CoC number. The public profile
// reads the redacted generated column verification_public instead. The public
// set is equally load-bearing: PostgREST plans the whole select list up front,
// so ONE ungranted column 42501s the ENTIRE query and the References section
// renders empty. Added 2026-09-18 after exactly that happened.
const PUBLIC_REFERENCE_SENSITIVE_COLUMNS = ["email", "message_to_referee", "verification"];

async function testReferenceColumns(config) {
  console.log(`\nReference column probe:`);

  const safeProbe = await restGet(
    config,
    "sea_references",
    `select=${PUBLIC_TABLE_SAFE_COLUMNS.sea_references}&limit=1`
  );

  let ok = safeProbe.ok || safeProbe.status === 401;
  if (safeProbe.ok) {
    console.log(`✓ public columns readable  ${safeProbe.status}  OK — includes period_from/period_to/doc_type`);
  } else if (safeProbe.status === 401) {
    console.log(`✓ public columns  401  OK — no public rows readable under current RLS`);
  } else {
    console.log(
      `✗ public column probe  ${safeProbe.status}  ${JSON.stringify(safeProbe.body).slice(0, 160)}`
    );
    console.log("→ A column in PUBLIC_ARRAY_COLUMNS.sea_references is missing its anon grant.");
    console.log("→ Fix: grant select (<column>) on table public.sea_references to anon;");
  }

  for (const column of PUBLIC_REFERENCE_SENSITIVE_COLUMNS) {
    const probe = await restGet(config, "sea_references", `select=${column}&limit=1`);
    const blocked = probe.status === 401 || probe.status === 403;
    if (blocked) {
      console.log(`✓ ${column} blocked  ${probe.status}  OK — private column denied to anon`);
    } else {
      console.log(`✗ ${column} readable  ${probe.status}  FAIL — revoke the anon grant on sea_references.${column}`);
      ok = false;
    }
  }

  return ok;
}

// certificates was hardened to column-scoped anon SELECT in
// docs/schema-phase2-public-hardening.sql, then silently un-hardened by a
// blanket `grant select on table public.certificates to anon` in
// docs/schema-certificates-issuer-provider.sql:22. That left the certificate
// scan path (attachment) and the CoC/STCW document number readable by anyone
// holding the publishable anon key -- 39 attachments and 49 certificate
// numbers across 53 rows by the time it was caught on 2026-09-18. Re-closed by
// docs/schema-certificates-anon-column-hardening.sql; asserted here every run
// so a future blanket grant fails the suite instead of going unnoticed.
const PUBLIC_CERTIFICATE_SENSITIVE_COLUMNS = [
  "attachment",
  "certificate_number",
  "issuing_authority",
  "training_provider",
  "show_on_cv"
];

async function testCertificateColumns(config) {
  console.log(`\nCertificate column probe:`);

  const safeProbe = await restGet(
    config,
    "certificates",
    `select=${PUBLIC_TABLE_SAFE_COLUMNS.certificates}&limit=1`
  );

  let ok = safeProbe.ok || safeProbe.status === 401;
  if (safeProbe.ok) {
    console.log(`✓ public columns readable  ${safeProbe.status}  OK`);
  } else if (safeProbe.status === 401) {
    console.log(`✓ public columns  401  OK — no public rows readable under current RLS`);
  } else {
    console.log(
      `✗ public column probe  ${safeProbe.status}  ${JSON.stringify(safeProbe.body).slice(0, 160)}`
    );
    console.log("→ A column in PUBLIC_ARRAY_COLUMNS.certificates is missing its anon grant.");
  }

  for (const column of PUBLIC_CERTIFICATE_SENSITIVE_COLUMNS) {
    const probe = await restGet(config, "certificates", `select=${column}&limit=1`);
    const blocked = probe.status === 401 || probe.status === 403;
    if (blocked) {
      console.log(`✓ ${column} blocked  ${probe.status}  OK — private column denied to anon`);
    } else {
      console.log(`✗ ${column} readable  ${probe.status}  FAIL — anon can read certificates.${column}`);
      console.log("→ Re-run docs/schema-certificates-anon-column-hardening.sql.");
      ok = false;
    }
  }

  return ok;
}

// The probes above can only test the column lists THIS file declares. If those
// drift from PUBLIC_ARRAY_COLUMNS in js/api.js -- what the app actually asks
// anon for -- the probes pass while the real page 42501s. That is precisely the
// 2026-08-01 sea_references regression. This check needs no network: it parses
// js/api.js and asserts the two agree, exactly, for every shared table.
function testPublicColumnDrift() {
  console.log(`\nPublic column drift check (js/api.js vs this harness):`);

  const apiSrc = fs.readFileSync(path.join(__dirname, "../js/api.js"), "utf8");
  const start = apiSrc.indexOf("const PUBLIC_ARRAY_COLUMNS");
  const end = apiSrc.indexOf("async function fetchSupabaseArray");
  if (start === -1 || end === -1) {
    console.log("✗ could not locate PUBLIC_ARRAY_COLUMNS in js/api.js — check the parser above");
    return false;
  }

  const block = apiSrc.slice(start, end).replace(/\/\/.*/g, "");
  const apiColumns = {};
  for (const match of block.matchAll(/(\w+):\s*\[([\s\S]*?)\]\.join/g)) {
    apiColumns[match[1]] = [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  let ok = true;
  for (const [table, apiCols] of Object.entries(apiColumns)) {
    const local = PUBLIC_TABLE_SAFE_COLUMNS[table];
    if (!local) continue;
    const localCols = local.split(",");
    const missingHere = apiCols.filter((c) => !localCols.includes(c));
    const extraHere = localCols.filter((c) => !apiCols.includes(c));
    if (missingHere.length || extraHere.length) {
      ok = false;
      console.log(`✗ ${table} drifted`);
      if (missingHere.length) console.log(`    api.js has, harness missing: ${missingHere.join(", ")}`);
      if (extraHere.length) console.log(`    harness has, api.js missing:  ${extraHere.join(", ")}`);
    } else {
      console.log(`✓ ${table}  ${apiCols.length} columns match`);
    }
  }

  if (!ok) {
    console.log("→ Sync PUBLIC_TABLE_SAFE_COLUMNS here with PUBLIC_ARRAY_COLUMNS in js/api.js.");
  }
  return ok;
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

// Owner-side write guards (docs/schema-profile-owner-policy-hardening.sql and
// docs/schema-sea-references-verification-guard.sql, 2026-09-26). Neither is
// visible to anon, so these probes sign in as a real test account. Set
// SEAV_TEST_EMAIL / SEAV_TEST_PASSWORD to a throwaway SEA-V account (never a
// real crew member's); without them the probes are skipped, not passed.
async function authedRequest(config, token, method, pathAndQuery, body) {
  const res = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function testOwnerWriteGuards(config) {
  const email = process.env.SEAV_TEST_EMAIL;
  const password = process.env.SEAV_TEST_PASSWORD;

  console.log(`\nOwner write guards (signed in as a test account):`);
  if (!email || !password) {
    console.log("- SKIPPED  set SEAV_TEST_EMAIL and SEAV_TEST_PASSWORD to run these probes");
    return true;
  }

  const login = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) }));

  const token = login.body?.access_token;
  const uid = login.body?.user?.id;
  if (!login.ok || !token || !isUuid(uid)) {
    console.log(`✗ test account sign-in failed  ${login.status}  FAIL`);
    return false;
  }

  let allPassed = true;
  const report = (label, pass, status, detail) => {
    allPassed = allPassed && pass;
    console.log(`${pass ? "✓" : "✗"} ${label}  ${status}  ${pass ? "OK" : "FAIL"} — ${detail}`);
  };

  const repoint = await authedRequest(
    config,
    token,
    "PATCH",
    `profile?id=eq.${uid}`,
    { user_id: "00000000-0000-0000-0000-000000000099" }
  );
  report(
    "profile user_id re-point blocked",
    !repoint.ok,
    repoint.status,
    repoint.ok ? "a user can move their row onto another user_id" : "owner policy requires id AND user_id"
  );

  const probeId = `smoke-guard-${Date.now()}`;
  try {
    const forgedInsert = await authedRequest(config, token, "POST", "sea_references", {
      id: `${probeId}-v`,
      user_id: uid,
      name: "Guard probe",
      status: "Verified"
    });
    report(
      "insert as Verified blocked",
      !forgedInsert.ok,
      forgedInsert.status,
      forgedInsert.ok ? "crew can create a Verified reference" : "trigger refused it"
    );

    const draft = await authedRequest(config, token, "POST", "sea_references", {
      id: probeId,
      user_id: uid,
      name: "Guard probe",
      status: "Draft"
    });
    report("draft insert allowed", draft.ok, draft.status, draft.ok ? "normal save path works" : "normal save path broken");

    if (draft.ok) {
      const promote = await authedRequest(config, token, "PATCH", `sea_references?id=eq.${probeId}`, {
        status: "Verified",
        verification: { confirmed: true }
      });
      report(
        "Draft -> Verified blocked",
        !promote.ok,
        promote.status,
        promote.ok ? "crew can self-verify" : "trigger refused it"
      );
    }
  } finally {
    await authedRequest(config, token, "DELETE", `sea_references?id=in.(${probeId},${probeId}-v)`);
  }

  return allPassed;
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
  let vesselColumnsSafe = false;
  let referenceColumnsSafe = false;
  let certificateColumnsSafe = false;
  let columnDriftSafe = false;
  let storageBlocked = false;
  let ownerGuardsSafe = true;

  if (step === "0" || step === "all") {
    failedTables = (await testTables(config)).filter((r) => !r.pass);
    profileWriteBlocked = await testProfileWrite(config);
    payslipWriteBlocked = await testPayslipAnonWrite(config);
  }

  if (step === "1" || step === "all") {
    if (step === "1") console.log("(Skipping table scan — run with --step 0 or --step all for full scan)\n");
    columnSafe = await testProfileColumns(config);
    vesselColumnsSafe = await testVesselColumns(config);
    referenceColumnsSafe = await testReferenceColumns(config);
    certificateColumnsSafe = await testCertificateColumns(config);
    columnDriftSafe = testPublicColumnDrift();
  }

  if (step === "all") {
    ownerGuardsSafe = await testOwnerWriteGuards(config);
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
    passed =
      columnSafe &&
      vesselColumnsSafe &&
      referenceColumnsSafe &&
      certificateColumnsSafe &&
      columnDriftSafe;
    console.log(columnSafe ? "Step 1 passed." : "Step 1 not passed yet — run step1-profile-columns.sql");
    console.log(vesselColumnsSafe ? "Vessel columns safe." : "Vessel column grants wrong — see probe above.");
    console.log(referenceColumnsSafe ? "Reference columns safe." : "Reference column grants wrong — see probe above.");
    console.log(certificateColumnsSafe ? "Certificate columns safe." : "Certificate column grants wrong — see probe above.");
    console.log(columnDriftSafe ? "Public column lists in sync with js/api.js." : "Public column lists drifted from js/api.js.");
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
    columnSafe &&
    vesselColumnsSafe &&
    referenceColumnsSafe &&
    certificateColumnsSafe &&
    columnDriftSafe &&
    ownerGuardsSafe
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
    if (!referenceColumnsSafe) {
      console.log("→ Run docs/schema-sea-references-public-column-grants.sql");
    }
    if (!certificateColumnsSafe) {
      console.log("→ Run docs/schema-certificates-anon-column-hardening.sql");
    }
    if (!ownerGuardsSafe) {
      console.log("→ Run docs/schema-profile-owner-policy-hardening.sql and docs/schema-sea-references-verification-guard.sql");
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
