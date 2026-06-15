-- =============================================================================
-- Fix: signed-in users see empty dashboard (permission denied on SELECT)
-- =============================================================================
-- Run once in Supabase SQL Editor after step1-profile-columns.sql hardening.
-- Safe to re-run.
-- =============================================================================

grant select on table public.profile to authenticated;
grant select on table public.vessels to authenticated;
grant select on table public.seatimes to authenticated;
grant select on table public.certificates to authenticated;
grant select on table public.sea_references to authenticated;
grant select on table public.tenders to authenticated;
grant select on table public.achievements to authenticated;
grant select on table public.navigation_areas to authenticated;
grant select on table public.onboard_experiences to authenticated;
grant select on table public.hobbies_interests to authenticated;
grant select on table public.specialist_qualifications to authenticated;
grant select on table public.payslips to authenticated;

grant insert, update, delete on table public.profile to authenticated;
grant insert, update, delete on table public.vessels to authenticated;
grant insert, update, delete on table public.seatimes to authenticated;
grant insert, update, delete on table public.certificates to authenticated;
grant insert, update, delete on table public.sea_references to authenticated;
grant insert, update, delete on table public.tenders to authenticated;
grant insert, update, delete on table public.achievements to authenticated;
grant insert, update, delete on table public.navigation_areas to authenticated;
grant insert, update, delete on table public.onboard_experiences to authenticated;
grant insert, update, delete on table public.hobbies_interests to authenticated;
grant insert, update, delete on table public.specialist_qualifications to authenticated;
grant insert, update, delete on table public.payslips to authenticated;
