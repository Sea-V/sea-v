# SQL setup guide — plain English

Use this when working in **Supabase → SQL Editor**. The filenames in `docs/` are technical; this guide tells you **what to run, in what order, and what to name each saved query**.

---

## Quick answer for your project

You’ve already signed up, logged in, and saved a profile — so you’ve almost certainly run **steps 1 and 2** below. You do **not** need to run everything again unless something is broken.

| You want to… | Run this file |
|--------------|---------------|
| Start a **brand new** Supabase project | Step 1, then Step 2 |
| Fix **“row level security” on signup** | Step 3 |
| Fix **photos/files not showing** on public profile | Step 4 |
| **Harden public profile + storage** (recommended before go-live) | Step 5 |
| Move old demo data to your account | Step 2 (optional block inside the file) |

---

## Run order (new project)

### Step 1 — Create all tables and storage

| | |
|--|--|
| **File** | `docs/schema-full.sql` |
| **Save in SQL Editor as** | `1 - Create all tables` |
| **What it does** | Creates profile, vessels, certificates, payslips, etc. + file storage buckets. Includes the old single-user demo setup. |
| **When** | Once, on a fresh Supabase project |

---

### Step 2 — Real accounts + private data per user

| | |
|--|--|
| **File** | `docs/schema-phase2.sql` |
| **Save in SQL Editor as** | `2 - Auth and per-user security` |
| **What it does** | Adds `user_id` to every table, locks data so each user only sees their own rows, makes storage private, creates profile on signup, allows public profile file viewing. |
| **When** | After Step 1, and after enabling **Email** auth in Supabase |
| **Prerequisite** | Step 1 done |

This is the main “production” security step. **Your real profile lives here.**

---

### Step 3 — Fix signup profile error (only if needed)

| | |
|--|--|
| **File** | `docs/schema-phase2-auth-trigger.sql` |
| **Save in SQL Editor as** | `3 - Fix signup profile (optional)` |
| **What it does** | Creates a profile row automatically when someone signs up. Backfills profiles for users who signed up before the trigger existed. |
| **When** | Only if signup failed with “row level security”, **or** you ran Step 2 before it included the trigger (section 6) |
| **Skip if** | Signup and login already work |

---

### Step 4 — Fix files on public profile (only if needed)

| | |
|--|--|
| **File** | `docs/schema-phase2-storage-public-photos.sql` |
| **Save in SQL Editor as** | `4 - Public profile files (optional)` |
| **What it does** | Lets visitors on your **public profile link** see photos and attachments (not payslips). |
| **When** | Public profile page loads but images/PDFs are missing |
| **Skip if** | You ran a recent `schema-phase2.sql` that already has section 7 |

---

### Step 5 — Public profile privacy + storage hardening (recommended)

| | |
|--|--|
| **File** | `docs/schema-phase2-public-hardening.sql` |
| **Save in SQL Editor as** | `5 - Public profile and storage hardening` |
| **What it does** | Stops anon users reading email/phone/salary on public profiles; only shows verified refs, approved achievements, signed-off ops, and published hobbies; re-applies private storage so anonymous uploads fail; drops legacy storage policies; restores authenticated CRUD grants. |
| **When** | Before going live, or if `node scripts/test-supabase.mjs` reports anon storage uploads succeeding |
| **Prerequisite** | Steps 1 and 2 done |

---

### Step 6 — Certificate catalog (optional, recommended)

| | |
|--|--|
| **File** | `docs/certificate-catalog.sql` |
| **Save in SQL Editor as** | `6 - Certificate catalog` |
| **What it does** | Seeds the master certificate list; the app loads this on the certificates page (falls back to built-in list if not run). |
| **When** | Before go-live if you want catalog updates without redeploying the site |
| **Prerequisite** | Steps 1 and 2 done |

---

### Step 7 — Reference verification emails (optional, recommended for go-live)

| | |
|--|--|
| **File** | `docs/schema-reference-verification.sql` |
| **Save in SQL Editor as** | `7 - Reference verification` |
| **What it does** | Token table + RPCs for referee email verification flow. |
| **When** | Before enabling reference verification in production |
| **Also** | Deploy `supabase/functions/reference-verification` and set `RESEND_API_KEY` |

---

### Step 8 — Account deletion (optional)

| | |
|--|--|
| **File** | `docs/schema-account-deletion.sql` |
| **Save in SQL Editor as** | `8 - Delete own account` |
| **What it does** | Lets signed-in users delete their account and all data from the app. |
| **When** | Before go-live if you need GDPR self-service delete |

---

## Do not run (unless you know you need them)

These are **older or optional** scripts. If you ran **Step 1 (`schema-full.sql`)**, you usually **do not** need these — the same tables are already in Step 1.

| File | Plain name | Notes |
|------|------------|--------|
| `schema-phase1.sql` | Old reference / snippets | Superseded by `schema-full.sql` |
| `hobbies-interests-table.sql` | Hobbies table only | Already in `schema-full.sql` |
| `onboard-experiences-table.sql` | Onboard experience table only | Already in `schema-full.sql` |
| `specialist-qualifications-table.sql` | Specialist quals table only | Already in `schema-full.sql` |
| `payslips-table.sql` | Payslips table only | Already in `schema-full.sql` |
| `certificates-templates-migration.sql` | Certificate template tidy-up | Optional; app syncs templates on load |

---

## Filename cheat sheet

| Confusing filename | Read it as |
|--------------------|------------|
| `schema-full.sql` | **Everything built (tables + buckets)** |
| `schema-phase2.sql` | **Real logins + your data is yours alone** |
| `schema-phase2-auth-trigger.sql` | **Auto-create profile on signup** |
| `schema-phase2-storage-public-photos.sql` | **Public link can show uploaded files** |
| `schema-phase2-public-hardening.sql` | **Lock down public profile + storage** |
| `schema-phase1.sql` | Old docs — ignore unless debugging |
| `*-table.sql` | Single feature — skip if you ran `schema-full` |

---

## How to check your profile is real

In Supabase:

1. **Authentication → Users** — your email appears with a UUID.
2. **Table Editor → `profile`** — one row where `user_id` matches that UUID (not `default-profile`).
3. In the app — log out and back in; your data is still there.

That means you’re on **Phase 2** with a real account, not the old demo profile.

---

## Related docs

- `docs/SUPABASE-PHASE2.md` — auth URLs, email confirm, testing
- `docs/SUPABASE-PHASE1.md` — legacy single-user demo (historical)
- `docs/SECURITY.md` — privacy and go-live checklist
