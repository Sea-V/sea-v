-- Add the is_tidal flag to navigation passages.
-- Run in Supabase SQL Editor if save fails with:
--   "Could not find the 'is_tidal' column of 'navigation_areas'"
--
-- Crew manually tick "This passage was in tidal waters" when logging a
-- passage. Used to track progress toward the RYA/MCA Yachtmaster Offshore
-- prerequisite: 2500 qualifying miles, at least half (1250) in tidal waters.
--
-- For a full navigation schema update, use docs/navigation-complete-migration.sql
-- instead.

alter table public.navigation_areas
  add column if not exists is_tidal boolean not null default false;
