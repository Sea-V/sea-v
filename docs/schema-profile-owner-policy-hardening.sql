-- =============================================================================
-- SEA-V -- Close the profile user_id re-pointing hole.
-- =============================================================================
--
-- THE BUG (found in the 2026-09-26 full audit)
-- --------------------------------------------
-- profile_owner_all allowed a write when EITHER
--     auth.uid() = user_id   OR   auth.uid()::text = id
-- and there was no UNIQUE constraint on profile.user_id. `authenticated` has
-- column UPDATE on user_id (it must: SeavAPI.save() upserts the whole mapped
-- row, and ON CONFLICT DO UPDATE writes every column it was given).
--
-- So user A could PATCH their own row (?id=eq.<A>, which passes the `id`
-- branch) setting user_id = <B> and public_enabled = true. Every anon
-- *_public_read policy only checks "a profile row exists with
-- p.user_id = child.user_id and public_enabled" -- so B's vessels, sea time,
-- certificates, passages, references and matching storage files would become
-- anon-readable although B never published. B's user_id is visible on any
-- public profile. Not exploited: at the time of this migration all 14 rows
-- had id = user_id and no user_id was duplicated.
--
-- THE FIX
-- -------
-- 1. UNIQUE (user_id): one profile per auth user, so a second row can never
--    claim someone else's user_id even if a policy regresses.
-- 2. The owner policy requires BOTH columns to be the caller. Every legitimate
--    writer already satisfies that: ensureProfileRow (js/auth.js) inserts
--    id = user_id = user.id, and mapProfileToSupabase (js/api-mappers.js)
--    sets both from getAuthUserId().
-- Column grants are left as they are -- revoking UPDATE on id/user_id would
-- break the upsert, and the WITH CHECK now makes changing them impossible.
--
-- STATUS: applied to the live project and smoke-tested 2026-09-26
-- (migration name: profile_owner_policy_require_both_ids).
-- =============================================================================

alter table public.profile
  add constraint profile_user_id_unique unique (user_id);

drop policy if exists profile_owner_all on public.profile;

create policy profile_owner_all on public.profile
  for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.uid())::text = id
  )
  with check (
    (select auth.uid()) = user_id
    and (select auth.uid())::text = id
  );
