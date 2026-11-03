-- =============================================================================
-- SEA-V -- profile.public_theme: the crew member's public profile palette (v590)
-- =============================================================================
--
-- Jack, 2026-11-03: the public profile should match the new style "and have
-- options for colors ... like a personalised cv that people can see". Five
-- palettes, the same names as the CV generator's colour schemes:
--   seav (default) | ocean-blue | night-watch | simple-green | pearl-grey
-- Styles: css/pages/public-profile-themes.css. Picker: Profile settings.
--
-- READ PATH. The public profile never selects the profile table directly; it
-- calls get_public_profile(), a SECURITY DEFINER function with a fixed
-- RETURNS TABLE. Adding a column to that return type needs DROP + CREATE
-- (CREATE OR REPLACE cannot change it). A new function gets EXECUTE for
-- PUBLIC by default, so that is revoked and the exact previous ACL restored:
-- anon, authenticated, service_role (postgres owns it).
-- No direct anon column grant on profile.public_theme: the RPC is the only
-- public path, same as dob -> age.
--
-- WRITE PATH. authenticated has table-level INSERT/UPDATE on profile, so the
-- owner's upsert can set the column with no grant change. mapProfileToSupabase
-- only sends public_theme when the form supplies one, so the other callers
-- of SeavAPI.save (username, public toggle) never reset it.
--
-- APPLIED + SMOKE-TESTED 2026-11-03 (Supabase MCP apply_migration
-- profile_public_theme): see the header of the v590 entry in CLAUDE.md.
-- =============================================================================

alter table public.profile
  add column if not exists public_theme text not null default 'seav';

alter table public.profile
  drop constraint if exists profile_public_theme_check;
alter table public.profile
  add constraint profile_public_theme_check
  check (public_theme in ('seav', 'ocean-blue', 'night-watch', 'simple-green', 'pearl-grey'));

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_lookup text)
returns table(
  id text, user_id text, username text, name text, rank text,
  qualification text, nationality text, location text, availability text,
  bio text, photo jsonb, public_enabled boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  passports_held text, visas_held text, age integer, public_theme text
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.user_id::text,
    p.username, p.name, p.rank, p.qualification, p.nationality,
    p.location, p.availability, p.bio, p.photo, p.public_enabled, p.created_at, p.updated_at,
    p.passports_held, p.visas_held,
    case
      when p.dob ~ '^\d{4}-\d{2}-\d{2}$'
        then date_part('year', age(current_date, p.dob::date))::int
      else null
    end as age,
    p.public_theme
  from public.profile p
  where p.public_enabled = true
    and (
      lower(p.username) = lower(p_lookup)
      or p.id = p_lookup
      or p.user_id::text = p_lookup
    )
  order by
    case
      when lower(p.username) = lower(p_lookup) then 0
      when p.id = p_lookup then 1
      else 2
    end
  limit 1;
$function$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;
