-- SEA addendums on a vessel (v565, 2026-10-03).
--
-- Why: Simon Lindström's suggestion in the admin reports (2026-08-29):
-- "Allow multiple files to be uploaded on Vessel SEA so addendums to SEA
-- can be added". vessels.sea_attachment holds ONE file — the signed
-- Seafarer Employment Agreement — and stays exactly as it is. Addendums
-- (pay rises, extensions, rank changes) go in a new list beside it.
--
-- Shape: jsonb array of stored-file objects, the same shape as
-- onboard_experiences.photos ({bucket, path, filename, mime, size,
-- uploadedAt, label}), files in the existing private `vessel-documents`
-- bucket under the owner's folder. Capped at 10.
--
-- PRIVATE, like sea_attachment / salary / leave_package: nothing is granted
-- to anon, and it is NOT in PUBLIC_ARRAY_COLUMNS. authenticated has a
-- TABLE-level grant on vessels and the owner RLS policy already covers
-- every column, so no grant is needed for the owner.

alter table public.vessels
  add column if not exists sea_addendums jsonb not null default '[]'::jsonb;

alter table public.vessels
  drop constraint if exists vessels_sea_addendums_is_array;
alter table public.vessels
  add constraint vessels_sea_addendums_is_array
  check (jsonb_typeof(sea_addendums) = 'array' and jsonb_array_length(sea_addendums) <= 10);

-- APPLIED 2026-10-03 as migration vessels_sea_addendums. Smoke-tested as the
-- real `authenticated` role (JWT claims set, rolled back): every existing
-- vessel row defaulted to []; owner write + read-back of a labelled file OK;
-- a non-array and an 11-item list both refused by the check; another user
-- updates 0 rows. curl as anon: select=sea_addendums -> 42501, the public
-- vessel columns still 200. Security advisors 23 before and after, none new.
-- Covered on every run: PUBLIC_VESSEL_SENSITIVE_COLUMNS in
-- scripts/test-supabase.mjs (--step all exit 0).
