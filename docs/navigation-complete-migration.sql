-- Navigation complete migration
-- Run this once in Supabase SQL Editor.
-- Safe to run more than once: all column additions use IF NOT EXISTS.
--
-- Covers:
-- - departure/arrival port names and chart coordinates
-- - passage name / ECDIS passage title reference
-- - departure and arrival dates
-- - ordered waypoint list for manual, recommended, KML, and RTZ routes

create table if not exists public.navigation_areas (
  id text primary key,
  country text default '',
  port text default '',
  from_country text default '',
  from_port text default '',
  from_lat numeric default 0,
  from_lng numeric default 0,
  to_country text default '',
  to_port text default '',
  to_lat numeric default 0,
  to_lng numeric default 0,
  vessel_id text,
  seatime_id text,
  operation_type text default '',
  passage_name text default '',
  visited_date date,
  departure_date date,
  arrival_date date,
  lat numeric default 0,
  lng numeric default 0,
  waypoints jsonb default '[]'::jsonb,
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.navigation_areas add column if not exists country text default '';
alter table public.navigation_areas add column if not exists port text default '';
alter table public.navigation_areas add column if not exists from_country text default '';
alter table public.navigation_areas add column if not exists from_port text default '';
alter table public.navigation_areas add column if not exists from_lat numeric default 0;
alter table public.navigation_areas add column if not exists from_lng numeric default 0;
alter table public.navigation_areas add column if not exists to_country text default '';
alter table public.navigation_areas add column if not exists to_port text default '';
alter table public.navigation_areas add column if not exists to_lat numeric default 0;
alter table public.navigation_areas add column if not exists to_lng numeric default 0;
alter table public.navigation_areas add column if not exists vessel_id text;
alter table public.navigation_areas add column if not exists seatime_id text;
alter table public.navigation_areas add column if not exists operation_type text default '';
alter table public.navigation_areas add column if not exists passage_name text default '';
alter table public.navigation_areas add column if not exists visited_date date;
alter table public.navigation_areas add column if not exists departure_date date;
alter table public.navigation_areas add column if not exists arrival_date date;
alter table public.navigation_areas add column if not exists lat numeric default 0;
alter table public.navigation_areas add column if not exists lng numeric default 0;
alter table public.navigation_areas add column if not exists waypoints jsonb default '[]'::jsonb;
alter table public.navigation_areas add column if not exists note text default '';
alter table public.navigation_areas add column if not exists created_at timestamptz default now();
alter table public.navigation_areas add column if not exists updated_at timestamptz default now();

-- Backfill arrival details from the legacy single destination columns.
update public.navigation_areas
set
  to_country = coalesce(nullif(to_country, ''), country, ''),
  to_port = coalesce(nullif(to_port, ''), port, ''),
  to_lat = case when coalesce(to_lat, 0) = 0 then coalesce(lat, 0) else to_lat end,
  to_lng = case when coalesce(to_lng, 0) = 0 then coalesce(lng, 0) else to_lng end
where
  coalesce(to_country, '') = ''
  or coalesce(to_port, '') = ''
  or coalesce(to_lat, 0) = 0
  or coalesce(to_lng, 0) = 0;

-- Keep legacy destination fields aligned for older parts of the app.
update public.navigation_areas
set
  country = coalesce(nullif(country, ''), to_country, ''),
  port = coalesce(nullif(port, ''), to_port, ''),
  lat = case when coalesce(lat, 0) = 0 then coalesce(to_lat, 0) else lat end,
  lng = case when coalesce(lng, 0) = 0 then coalesce(to_lng, 0) else lng end
where
  coalesce(country, '') = ''
  or coalesce(port, '') = ''
  or coalesce(lat, 0) = 0
  or coalesce(lng, 0) = 0;

-- Backfill new optional fields.
update public.navigation_areas
set passage_name = ''
where passage_name is null;

update public.navigation_areas
set waypoints = '[]'::jsonb
where waypoints is null;

-- Backfill dates. Some early databases may have visited_date as text rather
-- than date, so handle both cases safely.
do $$
declare
  visited_date_type text;
begin
  select data_type
  into visited_date_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'navigation_areas'
    and column_name = 'visited_date';

  if visited_date_type = 'date' then
    update public.navigation_areas
    set departure_date = coalesce(departure_date, visited_date)
    where departure_date is null;

    update public.navigation_areas
    set visited_date = coalesce(visited_date, departure_date, arrival_date)
    where visited_date is null;
  else
    update public.navigation_areas
    set departure_date = coalesce(departure_date, nullif(visited_date, '')::date)
    where departure_date is null
      and nullif(visited_date, '') is not null
      and visited_date ~ '^\d{4}-\d{2}-\d{2}$';

    update public.navigation_areas
    set visited_date = coalesce(nullif(visited_date, ''), departure_date::text, arrival_date::text)
    where nullif(visited_date, '') is null;
  end if;
end $$;
