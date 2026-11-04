-- =============================================================================
-- SEA-V -- profile.public_layout: the crew member's public profile layout (v595)
-- =============================================================================
--
-- Jack, 2026-11-05: the current public profile stays exactly as it is and stays
-- the default, with the option of something more modern. Two layouts:
--   current (default) | modern
-- Styles: css/pages/public-profile-modern.css. Picker: Profile settings.
--
-- READ PATH. Same as public_theme: the public profile only reads this through
-- get_public_profile(), whose fixed RETURNS TABLE needs DROP + CREATE to gain a
-- column. A new function gets EXECUTE for PUBLIC by default, so that is revoked
-- and the previous ACL restored: anon, authenticated, service_role.
-- No direct anon column grant on profile.public_layout.
--
-- WRITE PATH. authenticated has table-level INSERT/UPDATE on profile, so the
-- owner can set it with no grant change. SeavAPI.savePublicLayout writes it on
-- its own; mapProfileToSupabase only sends it when supplied, so the other
-- callers of SeavAPI.save never reset it.
--
-- APPLIED + SMOKE-TESTED 2026-11-05 (Supabase MCP apply_migration
-- profile_public_layout): see the v595 entry in CLAUDE.md.
-- =============================================================================

alter table public.profile
  add column if not exists public_layout text not null default 'current';

alter table public.profile
  drop constraint if exists profile_public_layout_check;
alter table public.profile
  add constraint profile_public_layout_check
  check (public_layout in ('current', 'modern'));

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_lookup text)
returns table(
  id text, user_id text, username text, name text, rank text,
  qualification text, nationality text, location text, availability text,
  bio text, photo jsonb, public_enabled boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  passports_held text, visas_held text, age integer, public_theme text,
  public_layout text
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
    p.public_theme,
    p.public_layout
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
