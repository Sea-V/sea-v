-- Public profile: show EVERY onboard experience entry, whatever its status
-- Jack, 2026-09-30 (v549). Corrects docs/schema-public-read-onboard-and-self-declared.sql.
--
-- Why: that migration (2026-09-29) let anon read onboard entries in any
-- status except 'Draft'. But the sign-off feature was dropped on 2026-08-09
-- (js/onboard-experience.js: "a self-reported log ... not something needing a
-- senior officer's confirmation"), so the form has no status control and
-- mapOnboardExperienceToSupabase stores `status || "Draft"` on every save.
-- 'Draft' is not a choice anyone makes — it is simply every entry written
-- since August. Result: all 6 of Jack's Senses entries stayed hidden.
-- The recommendation behind the 'except Draft' rule was made without
-- checking the form; this restores the 2026-08-09 intent, "every logged
-- entry is shown on the public profile".
--
-- Awards are unaffected: achievements_public_read (Verified + Self-declared)
-- stays exactly as the earlier migration left it.
--
-- APPLIED 2026-09-30 as migration public_read_onboard_all_statuses.
-- Smoke-tested as anon with the app's full public select list: jack-sorrell
-- 8 onboard rows (6 Draft, 2 Not Signed Off; was 2); only rows of the two
-- public_enabled owners are returned; awards gate unchanged (non-Verified /
-- non-Self-declared = []); certificates private column still 42501.
-- Security advisors 23 before and after, none new. testPublicStatusGates in
-- scripts/test-supabase.mjs no longer probes onboard Draft (it would flag
-- this intended behaviour); --step all exit 0.
--
-- Revert to the 2026-09-29 rule: add `status is distinct from 'Draft' and`
-- back in front of the exists (...) below.

drop policy if exists onboard_experiences_public_read on public.onboard_experiences;
create policy onboard_experiences_public_read
  on public.onboard_experiences
  for select
  to anon
  using (
    exists (
      select 1 from public.profile p
      where p.user_id = onboard_experiences.user_id
        and p.public_enabled = true
    )
  );
