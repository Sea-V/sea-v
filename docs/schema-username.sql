-- =============================================================================
-- RUN ORDER: 6  |  SAVE AS IN SUPABASE: "6 - Profile username (vanity public links)"
-- =============================================================================
-- SEA-V — Add a unique, editable username so the public profile link can be
-- sea-v.com/u/<username> instead of a raw UUID. Nullable: existing profiles
-- without one keep working on the old ?p=<uuid> link.
-- Prerequisite: schema-full.sql, schema-phase2.sql, schema-phase2-public-hardening.sql.
-- Safe to re-run.
-- =============================================================================

alter table public.profile add column if not exists username text;

-- Case-insensitive uniqueness. Partial index skips NULLs so multiple
-- profiles without a username yet don't collide with each other.
create unique index if not exists profile_username_unique_idx
  on public.profile (lower(username))
  where username is not null;

-- Format guard mirrors the client-side slugify (js/seav-data.js
-- slugifyUsername): lowercase letters/digits/hyphens, 3-30 chars, no
-- leading/trailing/consecutive hyphens. Enforced here too so a direct
-- API/SQL write can't bypass the app's validation.
alter table public.profile drop constraint if exists profile_username_format;
alter table public.profile add constraint profile_username_format
  check (
    username is null
    or (
      char_length(username) between 3 and 30
      and username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  );

-- Anon needs to read username too, since the public profile lookup now tries
-- it as a third key (see js/api.js getPublicProfile). Re-states the full
-- anon column list from schema-phase2-public-hardening.sql plus username —
-- grant column lists are not additive, so this must be the full set.
grant select (
  id,
  user_id,
  name,
  rank,
  qualification,
  nationality,
  location,
  availability,
  bio,
  photo,
  username,
  public_enabled,
  created_at,
  updated_at
) on table public.profile to anon;

-- One-time backfill: give every existing profile with a name (and no
-- username yet) an auto-generated slug, deduped with a numeric suffix.
-- Safe to re-run — only touches rows where username is still null.
do $$
declare
  rec record;
  base text;
  candidate text;
  suffix int;
begin
  for rec in
    select id, name from public.profile
    where username is null and coalesce(trim(name), '') <> ''
  loop
    base := lower(regexp_replace(rec.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    base := left(base, 26);
    if char_length(base) < 3 then
      continue;
    end if;

    candidate := base;
    suffix := 1;
    while exists (select 1 from public.profile where lower(username) = candidate) loop
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    end loop;

    update public.profile set username = candidate where id = rec.id;
  end loop;
end $$;
