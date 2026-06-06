-- Step 5a-fix — anon needs user_id on profile for public RLS subqueries
-- Run if public profile or table probes return 401 after step 1.
-- Safe to re-run.

grant select (user_id) on table public.profile to anon;
