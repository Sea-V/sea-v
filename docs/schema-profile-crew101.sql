-- =============================================================================
-- SEA-V -- Crew 101 first-yacht checklist progress (v618)
-- =============================================================================
--
-- Jack, 2026-11-06: a guide for new crew, with a checklist they can tick off.
-- {done: [step ids], hidden: bool}. Private: anon's SELECT on profile is column-scoped,
-- so anon cannot read it, and get_public_profile does not return it. Only js/api.js
-- fetchCrew101 / saveCrew101 touch it; it is left out of the profile form's save.
--
-- APPLIED + SMOKE-TESTED 2026-11-06 (Supabase MCP apply_migration profile_crew101):
-- as the real authenticated role, own write 1 row and read back, another member's row
-- 0 rows and unchanged, a non-object refused, every other profile column unchanged
-- (hash match), all rolled back. curl as anon 401. Security advisors checked after.
-- test-supabase.mjs: testLastVisitPrivate covers this column too.
-- =============================================================================

alter table public.profile add column if not exists crew101 jsonb;

alter table public.profile drop constraint if exists profile_crew101_is_small_object;
alter table public.profile add constraint profile_crew101_is_small_object
  check (crew101 is null or (jsonb_typeof(crew101) = 'object' and pg_column_size(crew101) <= 4096));

comment on column public.profile.crew101 is
  'Crew 101 first-yacht checklist: {done: [step ids], hidden: bool}. Private: no anon grant, not returned by get_public_profile.';
