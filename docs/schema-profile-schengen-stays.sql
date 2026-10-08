-- profile.schengen_stays: the member's own Schengen stays (v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- Schengen days page (schengen.html). Days are worked out from passages;
-- these are the member's corrections: [{ id, from, to, inSchengen, note }]
-- — a flight home, a land trip, a passage never logged. PRIVATE: anon's
-- SELECT on profile is column-scoped and this column is deliberately NOT
-- granted (travel history), and it is not in PUBLIC_ARRAY_COLUMNS.
-- mapProfileToSupabase does not write it, so a profile-form save can never
-- blank it; it is saved on its own by SeavAPI.saveSchengenStays.

alter table public.profile
  add column if not exists schengen_stays jsonb not null default '[]'::jsonb;

alter table public.profile
  drop constraint if exists profile_schengen_stays_shape;
alter table public.profile
  add constraint profile_schengen_stays_shape
  check (jsonb_typeof(schengen_stays) = 'array' and jsonb_array_length(schengen_stays) <= 300);

-- SMOKE TEST 2026-10-08 (real authenticated role, rolled back): profile rows
-- 15 -> 15; member wrote and read back a stay; a non-array value violates
-- profile_schengen_stays_shape; has_column_privilege(anon) = false; curl as
-- anon selecting the column -> 42501. test-supabase.mjs probes it as a
-- sensitive profile column.
