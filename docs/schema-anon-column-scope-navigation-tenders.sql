-- =============================================================================
-- SEA-V -- Column-scope anon's SELECT on navigation_areas and tenders (v590).
-- =============================================================================
--
-- WHY (2026-09-26 audit, CLAUDE.md open thread 9)
-- -----------------------------------------------
-- Every other public table gives anon a COLUMN-scoped SELECT, so a new column
-- stays private until someone deliberately grants it. These two had a
-- TABLE-level grant, so any column added later -- a supervisor email, a
-- private note -- would have been readable by anyone with the publishable
-- key the moment it was created.
--
-- NOT A UI OR DATA CHANGE
-- -----------------------
-- Measured 2026-11-03 immediately before applying: every column that exists
-- on both tables is already in PUBLIC_ARRAY_COLUMNS in js/api.js, so the
-- grant below lists exactly the same columns anon can read today. The public
-- profile's queries are unchanged. RLS policies are untouched.
--
-- FROM NOW ON: a new column on either table needs
--   grant select (<col>) on public.<table> to anon;
-- AND an entry in PUBLIC_ARRAY_COLUMNS (js/api.js) and
-- PUBLIC_TABLE_SAFE_COLUMNS (scripts/test-supabase.mjs) if it is public.
--
-- APPLIED + SMOKE-TESTED 2026-11-03 (Supabase MCP apply_migration
-- anon_column_scope_navigation_tenders): anon has no table-level SELECT on
-- either table; the public column lists still read as anon via REST; row
-- counts unchanged; security advisors unchanged.
-- =============================================================================

revoke select on table public.navigation_areas from anon;
grant select (
  id, user_id, country, port, from_country, from_port, from_lat, from_lng,
  to_country, to_port, to_lat, to_lng, vessel_id, seatime_id, operation_type,
  passage_name, visited_date, departure_date, arrival_date, lat, lng,
  waypoints, note, is_tidal, passage_role, ocean_offshore, created_at,
  updated_at
) on public.navigation_areas to anon;

revoke select on table public.tenders from anon;
grant select (
  id, user_id, name, vessel_id, type, model, length, engine, capacity, reg,
  proficiency_level, description, photo, created_at, updated_at
) on public.tenders to anon;
