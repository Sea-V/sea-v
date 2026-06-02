-- Navigation passage name / reference (correlates with sea time entry + ECDIS passage plan title)
-- Run in Supabase SQL Editor if navigation_areas already exists.

alter table public.navigation_areas
  add column if not exists passage_name text default '';

update public.navigation_areas
set passage_name = ''
where passage_name is null;
