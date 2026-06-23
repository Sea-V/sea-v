-- Tender proficiency level (run in Supabase SQL Editor after Phase 2)

alter table public.tenders
  add column if not exists proficiency_level text default '';
