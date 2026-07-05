-- Link navigation passages to sea time entries.
-- Run in Supabase SQL Editor if save fails with:
--   "Could not find the 'seatime_id' column of 'navigation_areas'"
--
-- For a full navigation schema update (waypoints, dates, passage name, etc.),
-- use docs/navigation-complete-migration.sql instead.

alter table public.navigation_areas
  add column if not exists seatime_id text;
