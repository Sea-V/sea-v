-- SEA-V: captioned photo gallery on onboard experience entries (v536)
--
-- Per Jack (2026-09-27): one full-width photo per entry "takes the entire
-- row up". Entries now carry up to 4 photos, each with a required label and
-- an optional one-line description, shown as a tight thumbnail strip.
--
-- photos is a jsonb ARRAY of stored-file metadata, the same shape
-- hobbies_interests.photos already uses, plus two text keys:
--   [{ bucket, path, filename, mime, size, uploadedAt, label, caption }]
-- Files stay in the existing onboard-experience-files bucket, so the
-- storage policies are unchanged.
--
-- No data backfill. An old image in `attachment` is presented as the first
-- photo by mapOnboardExperienceFromSupabase (js/api-mappers.js) and moves
-- into `photos` the next time that entry is saved. `attachment` stays for
-- documents (PDF). That keeps the live v535 site working untouched until
-- the new code deploys.
--
-- anon's SELECT on this table is COLUMN-SCOPED (see CLAUDE.md), so the
-- public profile cannot read the new column without the grant below; it is
-- also listed in PUBLIC_ARRAY_COLUMNS (js/api.js) and
-- PUBLIC_TABLE_SAFE_COLUMNS (scripts/test-supabase.mjs). authenticated
-- already holds table-level privileges, so owners need no grant.
--
-- STATUS: see the note at the foot of this file.

alter table public.onboard_experiences
  add column if not exists photos jsonb not null default '[]'::jsonb;

alter table public.onboard_experiences
  drop constraint if exists onboard_experiences_photos_is_array;
alter table public.onboard_experiences
  add constraint onboard_experiences_photos_is_array
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 4);

grant select (photos) on public.onboard_experiences to anon;

-- APPLIED 2026-09-27 as migration `onboard_experiences_photos`, and
-- smoke-tested the same session:
--   * existing rows unchanged -- all 17 have photos = '[]';
--   * as the real `authenticated` owner (JWT claims set, rolled back): a
--     labelled photo wrote and read back; 5 photos and a non-array were
--     both refused by the check constraint;
--   * curl as anon: select=photos -> 200, select=signoff -> still 401,
--     PATCH photos -> 401;
--   * security advisors: 23 findings before and after, none new;
--   * scripts/test-supabase.mjs --step all passes, with photos in
--     PUBLIC_TABLE_SAFE_COLUMNS (drift check: 17 columns match js/api.js).
