-- =============================================================================
-- SEA-V — Expose dob, passports_held, visas_held to anon on public.profile
-- =============================================================================
-- Context: dob was intentionally EXCLUDED from anon's column grant in
-- docs/hardening-steps/step1-profile-columns.sql (2026-07-16) as an
-- identity-theft-risk mitigation, and passports_held/visas_held were never
-- added to any anon grant. Jack explicitly asked (2026-07-26) to show all
-- three on the public profile (standard on a maritime crew CV for
-- recruiters/agencies), accepting that tradeoff.
--
-- IMPORTANT: `grant select (...)` column lists are NOT additive — each grant
-- statement replaces the full anon column list for this table. This restates
-- the complete set from docs/schema-username.sql (the last one to touch it)
-- plus dob/passports_held/visas_held. If you add another public column later,
-- restate this full list again rather than trying to grant just the new one.
-- Applied live via Supabase MCP execute_sql on 2026-07-26; this file is the
-- source-of-truth record of that change.
-- =============================================================================

grant select (
  id,
  user_id,
  name,
  rank,
  qualification,
  nationality,
  location,
  availability,
  bio,
  photo,
  username,
  public_enabled,
  created_at,
  updated_at,
  dob,
  passports_held,
  visas_held
) on table public.profile to anon;
