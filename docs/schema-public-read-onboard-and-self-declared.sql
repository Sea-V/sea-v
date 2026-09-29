-- Public profile: show non-draft onboard experience and self-declared awards
-- Jack, 2026-09-29 (v543).
--
-- Why: both anon read policies were stricter than the page that reads them,
-- so records the code was written to show never reached it.
--   * onboard_experiences_public_read required status = 'Signed Off', but
--     js/public-profile-sections.js has shown every entry since 2026-08-09
--     ("no sign-off gate, per Jack"). Jack's 8 entries (6 Draft, 2 Not Signed
--     Off) were all invisible. His call: everything EXCEPT Draft.
--   * achievements_public_read required status = 'Verified', but manual
--     geographic milestones are stored as 'Self-declared' (v481) and both
--     renderAchievements and the per-vessel Awards group accept them. His
--     call: show them, labelled "Self-declared" on the tile.
--
-- Reach at time of writing (public profiles only): jack-sorrell +2 onboard,
-- +6 awards; simon-lindstrom +8 self-declared awards. No column grants
-- change — status was already anon-readable on both tables.
--
-- Revert: recreate each policy with its old predicate
--   onboard:      status = 'Signed Off'
--   achievements: status = 'Verified'
--
-- APPLIED 2026-09-29 as migration public_read_onboard_nondraft_and_self_declared_awards.
-- Smoke-tested as anon via PostgREST with the app's full public select lists:
-- jack-sorrell onboard 2 rows (both Not Signed Off, drafts hidden); awards 17
-- (9 auto Verified, 2 manual Verified, 6 Self-declared; the Declined one
-- hidden); status=eq.Draft / eq.Declined return []; certificates private
-- column still 42501. Security advisors 23 before and after, none new.
-- Covered on every run by testPublicStatusGates in scripts/test-supabase.mjs.

drop policy if exists onboard_experiences_public_read on public.onboard_experiences;
create policy onboard_experiences_public_read
  on public.onboard_experiences
  for select
  to anon
  using (
    status is distinct from 'Draft'
    and exists (
      select 1 from public.profile p
      where p.user_id = onboard_experiences.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read
  on public.achievements
  for select
  to anon
  using (
    status in ('Verified', 'Self-declared')
    and exists (
      select 1 from public.profile p
      where p.user_id = achievements.user_id
        and p.public_enabled = true
    )
  );
