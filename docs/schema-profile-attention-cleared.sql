-- =============================================================================
-- SEA-V -- Needs attention rows a member has cleared (v619)
-- =============================================================================
--
-- Jack, 2026-11-06: "the option to clear or acknowledge, so that if things are not
-- applicable they do not just sit there". {row key: what the row said when cleared},
-- so a row returns if the situation changes (see renderAttentionCard). Private: anon's
-- SELECT on profile is column-scoped, get_public_profile does not return it, and it is
-- left out of the profile form's save. Only fetchAttentionCleared / saveAttentionCleared
-- in js/api.js touch it.
--
-- APPLIED + SMOKE-TESTED 2026-11-06 (Supabase MCP apply_migration profile_attention_cleared):
-- as the real authenticated role, own write 1 row and read back, another member's row
-- 0 rows and unchanged, a non-object and an oversized value refused, every other profile
-- column unchanged (hash match), all rolled back. curl as anon 401. Advisors 23 -> 23.
-- test-supabase.mjs: testLastVisitPrivate covers this column too.
-- =============================================================================

alter table public.profile add column if not exists attention_cleared jsonb;

alter table public.profile drop constraint if exists profile_attention_cleared_is_small_object;
alter table public.profile add constraint profile_attention_cleared_is_small_object
  check (attention_cleared is null or (jsonb_typeof(attention_cleared) = 'object' and pg_column_size(attention_cleared) <= 8192));

comment on column public.profile.attention_cleared is
  'Needs attention rows the member cleared: {row key: what it said when cleared}. Private: no anon grant, not returned by get_public_profile.';
