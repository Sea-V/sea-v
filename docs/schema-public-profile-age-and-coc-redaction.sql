-- =============================================================================
-- SEA-V — Public profile: age instead of raw DOB, referee CoC numbers fully
-- hidden (2026-07-29)
-- =============================================================================
-- Context: privacy.html said passport/visa details and identity data were
-- never shown publicly, but the 2026-07-26 change (see
-- docs/schema-public-profile-add-dob-passports-visas.sql) added raw `dob` to
-- anon's column grant on public.profile, contradicting that. Jack asked to
-- keep dob as-is in the private profile (never changes) but only ever expose
-- a computed AGE publicly, and to fully hide any referee-entered CoC number
-- on sea_references — no partial reveal at all — while still indicating a
-- CoC was on file. passports_held/visas_held are confirmed free-text
-- COUNTRY-only fields (no document numbers stored), so those are untouched.
--
-- Applied live via Supabase MCP execute_sql/apply_migration on 2026-07-29;
-- this file is the source-of-truth record of that change. Two migrations
-- were run back-to-back:
--   1. public_profile_age_and_coc_redaction
--   2. replace_profile_public_view_with_definer_function (the first pass
--      used a plain VIEW for the age computation, which tripped the
--      Supabase linter's ERROR-level security_definer_view advisory since
--      views run as their owner by default. Replaced with a SECURITY
--      DEFINER FUNCTION instead — the same pattern already used throughout
--      this project for anon-callable redaction logic, e.g.
--      complete_reference_verification, request_reference_verification —
--      which the linter only WARNs on, a level already accepted
--      project-wide for this class of function.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Age instead of raw DOB for anon/public
-- ---------------------------------------------------------------------------
-- dob is stored as TEXT "YYYY-MM-DD" live (docs/schema-full.sql's `dob date`
-- does not match the live column type — live schema wins). Cast is guarded
-- by a format check so a malformed/empty dob yields a null age instead of
-- erroring the whole function.

-- Close the direct-table loophole: anon can no longer select the raw date of
-- birth off public.profile under any circumstance.
revoke select (dob) on table public.profile from anon;

create or replace function public.get_public_profile(p_lookup text)
returns table (
  id text,
  user_id text,
  username text,
  name text,
  rank text,
  qualification text,
  nationality text,
  location text,
  availability text,
  bio text,
  photo jsonb,
  public_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  passports_held text,
  visas_held text,
  age int
)
language sql
security definer
stable
set search_path = public
as $$
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
    end as age
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
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- js/api.js's SeavAPI.getPublicProfile calls this RPC instead of selecting
-- from public.profile directly. Matching JS-side column list removed dob
-- entirely; profile.age is now populated via api-mappers.js.

-- ---------------------------------------------------------------------------
-- 2. Fully redact referee CoC numbers on sea_references for anon/public
-- ---------------------------------------------------------------------------
-- verification jsonb previously included a real cocNumber, and anon had
-- direct column-level SELECT on the raw `verification` column — UI masking
-- alone did nothing, since the true number was retrievable via a plain REST
-- query regardless of what the page rendered. This generated column keeps
-- rank/signedAt/signatureImage/note intact (still used publicly) but
-- replaces cocNumber with boolean `true` (entered-but-hidden) rather than
-- omitting it, so the UI can say "CoC on file, hidden for privacy" instead
-- of showing nothing. Uses only immutable jsonb operators (-, ||, ->>) so it
-- qualifies as a STORED generated column (recomputes automatically whenever
-- `verification` changes).
alter table public.sea_references
  add column if not exists verification_public jsonb
  generated always as (
    case
      when verification is null then null
      when coalesce(verification->>'cocNumber', '') <> ''
        then (verification - 'cocNumber') || '{"cocNumber": true}'::jsonb
      else verification - 'cocNumber'
    end
  ) stored;

revoke select (verification) on table public.sea_references from anon;
grant select (verification_public) on table public.sea_references to anon;

-- js/api.js's PUBLIC_ARRAY_COLUMNS.sea_references now selects
-- verification_public instead of verification for anon/public reads.
-- js/api-mappers.js's mapRefFromSupabase falls back to verification_public
-- when the raw verification key isn't present in the row (i.e. only for
-- public/anon reads — owner reads via select("*") still get the real
-- verification and take priority).
--
-- Note: achievements.witness_coc_number was checked too and is NOT in
-- anon's column grant on public.achievements (confirmed live via
-- information_schema.column_privileges) and is not rendered anywhere on the
-- public profile — already safe, no change needed there.
