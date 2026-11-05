-- =============================================================================
-- SEA-V -- when a member last opened the dashboard (v617)
-- =============================================================================
--
-- Jack, 2026-11-06: "Since your last visit" on the dashboard. Kept on the account
-- rather than per device, so news seen on a phone does not show again on a laptop.
--
-- Private. anon's SELECT on profile is column-scoped, so anon cannot read this and
-- get_public_profile does not return it. Only js/api.js fetchLastVisit / saveLastVisit
-- touch it; it is left out of the profile form's save.
--
-- APPLIED + SMOKE-TESTED 2026-11-06 (Supabase MCP apply_migration profile_last_visit):
-- as the real authenticated role, own write 1 row and read back, another member's
-- row 0 rows, every other profile column unchanged (hash match), all rolled back.
-- curl as anon 401 / 42501, RPC does not return it. Security advisors 23 -> 23.
-- test-supabase.mjs: testLastVisitPrivate.
-- =============================================================================

alter table public.profile add column if not exists last_visit_at timestamptz;

comment on column public.profile.last_visit_at is
  'When the member last opened the dashboard, for Since your last visit. Private: no anon grant, not returned by get_public_profile.';
