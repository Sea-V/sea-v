# Supabase alignment — Phase 1 (single user / demo)

Phase 1 uses **one profile row** and shared tables. The app reads/writes profile with `id = 'default-profile'` (see `js/seav-data.js` and `js/api.js`).

## Project connection

Configured in `js/supabase.js` (URL + anon/publishable key). No service role key in the frontend.

## Tables the app uses

| Table | Used for |
|-------|----------|
| `profile` | Single profile (`id` must be `default-profile`) |
| `vessels` | Vessel history |
| `seatimes` | Sea service entries |
| `certificates` | Certificates |
| `sea_references` | References |
| `tenders` | Tenders |
| `achievements` | Achievements |
| `navigation_areas` | Ports / navigation log |
| `onboard_experiences` | Onboard skills, familiarisations, senior sign-off |
| `hobbies_interests` | Personal hobbies and interests with showcase photos |
| `specialist_qualifications` | Wellness, water sports, hospitality, and other specialist credentials |
| `payslips` | Private payslip records (tax year + month, PDF uploads) |

Column names in the app match the mappers in `js/api.js` (snake_case in Supabase, camelCase in JS).

## Storage buckets

- `profile-photos`
- `vessel-photos`
- `vessel-documents`
- `certificate-files`
- `reference-files`
- `seatime-files`
- `achievement-files`
- `tender-photos`
- `onboard-experience-files`
- `hobbies-interest-photos`
- `specialist-qualification-files`
- `payslip-files`

Buckets should allow uploads for your Phase 1 policy (often public read + authenticated/anon write for demo — tighten before multi-user).

## One-time setup (recommended)

Run **`docs/schema-full.sql`** in **Supabase → SQL Editor**. It creates all 12 tables, 12 storage buckets, and Phase 1 demo RLS policies in one go.

Then verify:

```bash
node scripts/test-supabase.mjs
```

Individual scripts under `docs/*-table.sql` remain for reference or partial migrations.

## One-time profile ID fix

If you previously saved a profile as `profile_primary`, run in **Supabase → SQL Editor**:

```sql
-- Prefer updating the existing row
UPDATE profile
SET id = 'default-profile'
WHERE id = 'profile_primary';

-- Or insert a default row if none exists
INSERT INTO profile (id, name, public_enabled, updated_at)
VALUES ('default-profile', '', false, now())
ON CONFLICT (id) DO NOTHING;
```

Then reload the site and save profile again from **Profile** page.

## Public profile (Phase 1)

- `public_enabled = true` → `public-profile.html` shows content
- `public_enabled = false` → shows “Profile not public” gate
- After ticking the checkbox, click **Save Profile** (or **View Public Profile**, which saves first).

If the flag never sticks, ensure the column exists:

```sql
ALTER TABLE profile
ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false;
```

## Onboard Experience table

Run **`docs/onboard-experiences-table.sql`** in the SQL Editor (table + storage bucket + upload policies in one script). File uploads fail with an RLS error until that script has been run.

## Hobbies & Interests table

Run **`docs/hobbies-interests-table.sql`** in the SQL Editor (table + `hobbies-interest-photos` storage bucket + upload policies). Photo uploads fail with an RLS error until that script has been run.

## Specialist Qualifications table

Run **`docs/specialist-qualifications-table.sql`** in the SQL Editor (table + storage bucket + upload policies). Same RLS/bucket requirement for file uploads.

## Payslips table

Run **`docs/payslips-table.sql`** in the SQL Editor (table + `payslip-files` storage bucket + upload policies). Payslips are **private** — they are not shown on the public profile. Use **Download pack** on the Payslips page to export a ZIP (PDFs + CSV summary) for your accountant.

## Logo asset

Place your brand file at **`img/logo.png`** (all pages reference that path).

## Certificate templates (legacy — optional)

The Certificates page no longer auto-seeds template rows on load. Users add certificates from the dropdown when they have them.

**Do not run** `docs/certificates-templates-migration.sql` on new setups — it inserts placeholder rows into the user `certificates` table and can make the public profile look populated when nothing was logged.

For the yacht certificate dropdown catalog (reference data only), use `docs/certificate-catalog.sql`. The app reads the catalog from `js/seav-data.js` (`CERT_CATALOG_GROUPS`).

**Minimum mandatory (yacht crew):** ENG1, PST, FPFF, EFA, PSSR, PSA — shown as static compliance slots on the public profile only when the user has saved each one.

## Phase 2 (later)

- Supabase Auth
- `user_id` on all tables
- Row Level Security per user

Do not enable strict multi-user RLS until the app uses `auth.uid()`.
