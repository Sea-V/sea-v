-- Navigation passage departure + arrival dates
-- Run in Supabase SQL Editor if navigation_areas already exists.

alter table public.navigation_areas
  add column if not exists departure_date date;
alter table public.navigation_areas
  add column if not exists arrival_date date;

-- Backfill from the legacy single passage date where available
update public.navigation_areas
set departure_date = coalesce(departure_date, visited_date)
where departure_date is null;
