-- Navigation passage columns (departure + arrival)
-- Run in Supabase SQL Editor if navigation_areas already exists from schema-full.sql step 1.

alter table public.navigation_areas add column if not exists from_country text default '';
alter table public.navigation_areas add column if not exists from_port text default '';
alter table public.navigation_areas add column if not exists from_lat numeric default 0;
alter table public.navigation_areas add column if not exists from_lng numeric default 0;
alter table public.navigation_areas add column if not exists to_country text default '';
alter table public.navigation_areas add column if not exists to_port text default '';
alter table public.navigation_areas add column if not exists to_lat numeric default 0;
alter table public.navigation_areas add column if not exists to_lng numeric default 0;
alter table public.navigation_areas add column if not exists seatime_id text;

-- Backfill arrival fields from legacy country/port columns where needed
update public.navigation_areas
set
  to_country = coalesce(nullif(to_country, ''), country, ''),
  to_port = coalesce(nullif(to_port, ''), port, ''),
  to_lat = case when coalesce(to_lat, 0) = 0 then coalesce(lat, 0) else to_lat end,
  to_lng = case when coalesce(to_lng, 0) = 0 then coalesce(lng, 0) else to_lng end
where coalesce(to_country, '') = '' or coalesce(to_port, '') = '';
