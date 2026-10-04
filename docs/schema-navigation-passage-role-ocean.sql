-- Passage role + ocean flag for the RYA Yachtmaster checklists (v571, Jack 2026-10-04).
--
-- Why: the RYA Yachtmaster Offshore exam needs "5 passages over 60 miles,
-- including 2 overnight and 2 as skipper" and "5 days as skipper", and the
-- Yachtmaster Ocean exam needs a qualifying passage on which the candidate
-- "acted in a responsible capacity, either in sole charge of a watch or as
-- skipper", with "at least 200M more than 50 miles from land". Passages
-- stored distance, dates, vessel and a tidal tick, but not the crew
-- member's role or whether the passage went that far offshore.
--
-- passage_role: 'Skipper' | 'Watch leader' | 'Crew', or null (not stated).
-- ocean_offshore: self-declared "200+ NM of this passage was more than 50 NM
-- from land" — a start, end and a few waypoints cannot prove it, so it is a
-- tick like is_tidal.
--
-- PUBLIC like the rest of the passage: anon already has a TABLE-level SELECT
-- on navigation_areas (thread 9 notes it), so both columns are readable by
-- the public profile without a grant; added to PUBLIC_ARRAY_COLUMNS in
-- js/api.js so the public milestone progress matches the private one.

alter table public.navigation_areas
  add column if not exists passage_role text,
  add column if not exists ocean_offshore boolean not null default false;

alter table public.navigation_areas
  drop constraint if exists navigation_areas_passage_role_check;
alter table public.navigation_areas
  add constraint navigation_areas_passage_role_check
  check (passage_role is null or passage_role in ('Skipper', 'Watch leader', 'Crew'));

-- APPLIED 2026-10-04 as migration navigation_passage_role_ocean. Smoke-tested
-- as the real `authenticated` role (JWT claims set, rolled back): all 55
-- existing passages defaulted (role null, ocean false); owner write +
-- read-back OK; 'Captain' refused by the check; another user updates 0
-- rows. curl as anon: both columns readable (intended — table-level grant).
-- Security advisors 23 before and after. Covered on every run by the
-- navigation_areas entry in PUBLIC_TABLE_SAFE_COLUMNS (test-supabase.mjs,
-- --step all exit 0).
