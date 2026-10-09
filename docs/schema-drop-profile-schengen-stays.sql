-- v586 (2026-10-09): drop profile.schengen_stays.
--
-- Schengen Days was removed in v582 (Jack: "its too much"). The column was
-- kept while v581 (which still selected it) could be live; sea-v.com is on
-- v585 and no deployed or repo code reads it. Checked before dropping:
-- 0 of 15 profiles held any stays, no function or view references it, and
-- its only dependant is its own check constraint (dropped with it).
--
-- APPLIED 2026-10-09 as migration drop_profile_schengen_stays. Smoke test:
-- profile row count unchanged (15), owner select of OWNER_PROFILE_COLUMNS
-- as the authenticated role still works, anon public profile still loads,
-- advisors 23/23. The schengen probe was removed from test-supabase.mjs.

alter table public.profile drop constraint if exists profile_schengen_stays_shape;
alter table public.profile drop column if exists schengen_stays;
