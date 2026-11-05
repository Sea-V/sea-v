-- =============================================================================
-- SEA-V -- shared yacht directory (v609)
-- =============================================================================
--
-- Jack, 2026-11-05: when someone creates a vessel it should save to a shared
-- database. Two layers:
--   vessel_directory  FACTS about a yacht, shared: one row per hull.
--   vessels           ONE CREW MEMBER'S time on it, as before, plus directory_id.
-- Nothing is merged or deleted. A directory change never touches a crew record:
-- details are copied once, so a testimonial keeps the yacht as it was then.
--
-- IDENTITY: IMO first (stays with the hull, has a check digit), then MMSI, then
-- official number + flag. A name alone is never identity: two yachts can share one.
--
-- WHO SEES WHAT: signed-in members only; anon has nothing. created_by is not
-- readable by members, so the directory can never show who added or served on a yacht.
-- Members can add but not edit. A member whose details disagree keeps their own and
-- a row goes in vessel_directory_flags for the admin page.
--
-- The guard trigger is SECURITY DEFINER because it counts created_by, which members
-- cannot read. It lives in the non-API schema `private`, like mfa_satisfied.
--
-- BACKFILL: only rows with a VALID IMO from non-demo accounts. The demo account's
-- made-up IMOs fail the check digit. Records with no number are left unlinked.
--
-- APPLIED + SMOKE-TESTED 2026-11-05 (Supabase MCP apply_migration vessel_directory):
-- see the v609 entry in CLAUDE.md. test-supabase.mjs: testVesselDirectoryPrivate.
-- To undo: drop table vessel_directory_flags; drop column vessels.directory_id;
-- drop table vessel_directory; drop the two private functions.
-- =============================================================================

create or replace function private.valid_imo(p text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p ~ '^\d{7}$' and (
    (substr(p,1,1)::int * 7 + substr(p,2,1)::int * 6 + substr(p,3,1)::int * 5 +
     substr(p,4,1)::int * 4 + substr(p,5,1)::int * 3 + substr(p,6,1)::int * 2) % 10
  ) = substr(p,7,1)::int;
$function$;

grant execute on function private.valid_imo(text) to authenticated, service_role;

create table public.vessel_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  imo text check (imo is null or private.valid_imo(imo)),
  mmsi text check (mmsi is null or mmsi ~ '^\d{9}$'),
  official_number text check (official_number is null or length(official_number) <= 40),
  flag text check (flag is null or length(flag) <= 80),
  call_sign text check (call_sign is null or length(call_sign) <= 20),
  gt text check (gt is null or length(gt) <= 40),
  vessel_length text check (vessel_length is null or length(vessel_length) <= 40),
  builder text check (builder is null or length(builder) <= 120),
  vessel_type text check (vessel_type is null or length(vessel_type) <= 80),
  year_built text check (year_built is null or length(year_built) <= 10),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vessel_directory_has_identity check (
    imo is not null or mmsi is not null or (official_number is not null and flag is not null)
  )
);

create unique index vessel_directory_imo_unique on public.vessel_directory (imo) where imo is not null;
create unique index vessel_directory_mmsi_unique on public.vessel_directory (mmsi) where mmsi is not null;
create unique index vessel_directory_official_unique
  on public.vessel_directory (lower(official_number), lower(flag)) where official_number is not null;
create index vessel_directory_name_idx on public.vessel_directory (lower(name));
create index vessel_directory_created_by_idx on public.vessel_directory (created_by);

create table public.vessel_directory_flags (
  id uuid primary key default gen_random_uuid(),
  directory_id uuid not null references public.vessel_directory (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  field text not null check (field in ('name','imo','mmsi','official_number','flag','gt','vessel_length')),
  directory_value text,
  submitted_value text check (length(submitted_value) <= 120),
  created_at timestamptz not null default now(),
  unique (directory_id, user_id, field, submitted_value)
);

create index vessel_directory_flags_user_idx on public.vessel_directory_flags (user_id);

alter table public.vessels
  add column if not exists directory_id uuid references public.vessel_directory (id) on delete set null;

create index if not exists vessels_directory_id_idx on public.vessels (directory_id);

-- Stamps the author, tidies values and limits additions to 20 a day per member.
create or replace function private.vessel_directory_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  recent int;
begin
  if current_user in ('authenticated', 'anon') then
    new.created_by := auth.uid();
    select count(*) into recent
      from public.vessel_directory d
      where d.created_by = new.created_by and d.created_at > now() - interval '24 hours';
    if recent >= 20 then
      raise exception 'Too many yachts added today.' using errcode = 'P0001';
    end if;
  end if;
  new.name := btrim(new.name);
  new.imo := nullif(btrim(coalesce(new.imo, '')), '');
  new.mmsi := nullif(btrim(coalesce(new.mmsi, '')), '');
  new.official_number := nullif(btrim(coalesce(new.official_number, '')), '');
  new.flag := nullif(btrim(coalesce(new.flag, '')), '');
  return new;
end;
$function$;

create trigger vessel_directory_guard
  before insert on public.vessel_directory
  for each row execute function private.vessel_directory_guard();

alter table public.vessel_directory enable row level security;
alter table public.vessel_directory_flags enable row level security;

revoke all on public.vessel_directory from anon, authenticated;
revoke all on public.vessel_directory_flags from anon, authenticated;

-- No created_by in either grant: members cannot read or set it.
grant select (id, name, imo, mmsi, official_number, flag, call_sign, gt, vessel_length,
              builder, vessel_type, year_built, created_at, updated_at)
  on public.vessel_directory to authenticated;
grant insert (name, imo, mmsi, official_number, flag, call_sign, gt, vessel_length,
              builder, vessel_type, year_built)
  on public.vessel_directory to authenticated;
grant update (name, imo, mmsi, official_number, flag, call_sign, gt, vessel_length,
              builder, vessel_type, year_built, updated_at)
  on public.vessel_directory to authenticated;
grant select, insert, delete on public.vessel_directory_flags to authenticated;

create policy vessel_directory_read on public.vessel_directory
  for select to authenticated using (true);
create policy vessel_directory_add on public.vessel_directory
  for insert to authenticated with check (auth.uid() is not null);
create policy vessel_directory_admin_update on public.vessel_directory
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mfa_required on public.vessel_directory
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy vessel_directory_flags_own_read on public.vessel_directory_flags
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy vessel_directory_flags_add on public.vessel_directory_flags
  for insert to authenticated with check (user_id = auth.uid());
create policy vessel_directory_flags_admin_delete on public.vessel_directory_flags
  for delete to authenticated using (public.is_admin());
create policy mfa_required on public.vessel_directory_flags
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- -----------------------------------------------------------------------------
-- Backfill: one directory row per valid IMO, using the most common value of each
-- field. Crew rows only gain directory_id. Disagreements become flags.
-- -----------------------------------------------------------------------------
create temporary table seed_rows on commit drop as
  select v.id as vessel_id, v.user_id, btrim(v.imo) as imo,
         btrim(v.name) as name, nullif(btrim(v.mmsi), '') as mmsi,
         nullif(btrim(v.official_number), '') as official_number, nullif(btrim(v.flag), '') as flag,
         nullif(btrim(v.call_sign), '') as call_sign, nullif(btrim(v.gt), '') as gt,
         nullif(btrim(v.vessel_length), '') as vessel_length, nullif(btrim(v.builder), '') as builder,
         nullif(btrim(v.vessel_type), '') as vessel_type, nullif(btrim(v.year_built), '') as year_built
  from public.vessels v
  join auth.users u on u.id = v.user_id
  where private.valid_imo(btrim(v.imo))
    and btrim(v.name) <> ''
    and u.email not ilike '%@sea-v-demo.com';

insert into public.vessel_directory
  (name, imo, mmsi, official_number, flag, call_sign, gt, vessel_length, builder, vessel_type, year_built)
select
  mode() within group (order by name),
  imo,
  mode() within group (order by mmsi) filter (where mmsi ~ '^\d{9}$'),
  mode() within group (order by official_number),
  mode() within group (order by flag),
  mode() within group (order by call_sign),
  mode() within group (order by gt),
  mode() within group (order by vessel_length),
  mode() within group (order by builder),
  mode() within group (order by vessel_type),
  mode() within group (order by year_built)
from seed_rows
group by imo;

update public.vessels v
   set directory_id = d.id
  from seed_rows s
  join public.vessel_directory d on d.imo = s.imo
 where v.id = s.vessel_id;

insert into public.vessel_directory_flags (directory_id, user_id, field, directory_value, submitted_value)
select d.id, s.user_id, x.field, x.dir_value, x.row_value
from seed_rows s
join public.vessel_directory d on d.imo = s.imo
cross join lateral (values
  ('mmsi', d.mmsi, s.mmsi),
  ('official_number', d.official_number, s.official_number),
  ('flag', d.flag, s.flag),
  ('gt', d.gt, s.gt),
  ('vessel_length', d.vessel_length, s.vessel_length)
) as x(field, dir_value, row_value)
where x.row_value is not null and x.dir_value is not null
  and lower(x.row_value) <> lower(x.dir_value)
on conflict do nothing;
