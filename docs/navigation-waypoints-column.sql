-- Navigation passage waypoints (intermediate points between departure and arrival)
-- Run in Supabase SQL Editor if navigation_areas already exists.
-- Stores an ordered list of { lat, lng, label } objects as JSON.

alter table public.navigation_areas
  add column if not exists waypoints jsonb default '[]'::jsonb;

-- Ensure existing rows have a valid empty array rather than NULL
update public.navigation_areas
set waypoints = '[]'::jsonb
where waypoints is null;
