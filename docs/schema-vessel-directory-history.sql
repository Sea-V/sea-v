-- =============================================================================
-- SEA-V -- a history for every yacht in the directory (v610)
-- =============================================================================
--
-- Jack, 2026-11-05: "update them based on the information you have found online, I
-- want to create a history for each vessel with more and more information that gets
-- uploaded."
--
-- vessel_directory_history: one row per yacht added and per field changed, with old
-- value, new value and where it came from (crew / admin / wikidata). Written only by
-- triggers. Signed-in members can read it; anon cannot. It holds no user ids, so it
-- can never show who supplied something or who served on a yacht.
--
-- MORE INFORMATION OVER TIME: when a crew record is linked and holds a detail the
-- directory is BLANK on, that detail fills the blank and is logged. Only blanks: one
-- person can never overwrite a value (differences still go to the admin review list).
-- Values are sanity-checked, demo accounts are ignored, and a failure here can never
-- stop a vessel saving.
--
-- This direction only. Directory changes NEVER reach a crew record, so a testimonial
-- keeps the yacht as it was when they served.
--
-- UPDATES FROM WIKIDATA (fetched 2026-11-05), old values kept in the history:
--   Senses        length 59 -> 57, builder Fr. Schweers -> Lürssen
--   Grace         length 81.0 -> 81.2, GT 2083 -> 2306
--   Kahalani      length 55 -> 55.18, GT 499 -> 891, builder Feadship -> Koninklijke De Vries Scheepsbouw
--   Stella Maris  year built 2015 -> 2013
--   Northern Star name "M/Y Northern Star" -> "Northern Star", length 75.6 -> 75,
--                 builder Lürssen -> Lürssen-Kröger-Werft, former name Scout logged
--   Global, Lucky Lady: not on Wikidata, unchanged.
--
-- APPLIED + SMOKE-TESTED 2026-11-05 (Supabase MCP apply_migration vessel_directory_history):
-- see the v610 entry in CLAUDE.md. test-supabase.mjs: testVesselDirectoryPrivate.
-- =============================================================================

create table public.vessel_directory_history (
  id uuid primary key default gen_random_uuid(),
  directory_id uuid not null references public.vessel_directory (id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  source text not null check (source in ('crew', 'admin', 'wikidata')),
  created_at timestamptz not null default now()
);

create index vessel_directory_history_yacht_idx
  on public.vessel_directory_history (directory_id, created_at desc);

alter table public.vessel_directory_history enable row level security;
revoke all on public.vessel_directory_history from anon, authenticated;
grant select on public.vessel_directory_history to authenticated;

create policy vessel_directory_history_read on public.vessel_directory_history
  for select to authenticated using (true);
create policy mfa_required on public.vessel_directory_history
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- Logs every addition and change, whoever or whatever made it.
create or replace function private.vessel_directory_log()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  src text := nullif(current_setting('seav.history_source', true), '');
  f text;
  old_v text;
  new_v text;
begin
  if tg_op = 'INSERT' then
    insert into public.vessel_directory_history (directory_id, field, new_value, source)
    values (new.id, 'added', new.name, coalesce(src, new.source, case when new.created_by is null then 'admin' else 'crew' end));
    return new;
  end if;
  foreach f in array array['name','imo','mmsi','official_number','flag','call_sign','gt',
                           'vessel_length','builder','vessel_type','year_built'] loop
    old_v := to_jsonb(old) ->> f;
    new_v := to_jsonb(new) ->> f;
    if old_v is distinct from new_v then
      insert into public.vessel_directory_history (directory_id, field, old_value, new_value, source)
      values (new.id, f, old_v, new_v, coalesce(src, 'admin'));
    end if;
  end loop;
  return new;
end;
$function$;

create trigger vessel_directory_log
  after insert or update on public.vessel_directory
  for each row execute function private.vessel_directory_log();

-- A linked crew record fills what the directory is blank on. Blanks only.
create or replace function private.vessel_directory_fill_from_crew()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  d public.vessel_directory;
  v_len text := nullif(btrim(new.vessel_length), '');
  v_gt text := nullif(btrim(new.gt), '');
  v_year text := nullif(btrim(new.year_built), '');
begin
  if new.directory_id is null then
    return new;
  end if;
  begin
    if exists (select 1 from auth.users u where u.id = new.user_id and u.email ilike '%@sea-v-demo.com') then
      return new;
    end if;
    select * into d from public.vessel_directory where id = new.directory_id;
    if not found then
      return new;
    end if;

    if v_len !~ '^\d{1,3}(\.\d+)?$' or v_len::numeric not between 5 and 250 then v_len := null; end if;
    if v_gt !~ '^[\d,. ]+( ?GT)?$' then v_gt := null; end if;
    if v_year !~ '^(19|20)\d{2}$' then v_year := null; end if;

    perform set_config('seav.history_source', 'crew', true);
    update public.vessel_directory set
      flag = coalesce(flag, nullif(btrim(new.flag), '')),
      call_sign = coalesce(call_sign, nullif(left(btrim(new.call_sign), 20), '')),
      gt = coalesce(gt, v_gt),
      vessel_length = coalesce(vessel_length, v_len),
      builder = coalesce(builder, nullif(left(btrim(new.builder), 120), '')),
      vessel_type = coalesce(vessel_type, nullif(left(btrim(new.vessel_type), 80), '')),
      year_built = coalesce(year_built, v_year),
      updated_at = now()
    where id = d.id
      and (
        (flag is null and nullif(btrim(new.flag), '') is not null) or
        (call_sign is null and nullif(btrim(new.call_sign), '') is not null) or
        (gt is null and v_gt is not null) or
        (vessel_length is null and v_len is not null) or
        (builder is null and nullif(btrim(new.builder), '') is not null) or
        (vessel_type is null and nullif(btrim(new.vessel_type), '') is not null) or
        (year_built is null and v_year is not null)
      );
    perform set_config('seav.history_source', '', true);
  exception when others then
    perform set_config('seav.history_source', '', true);
  end;
  return new;
end;
$function$;

create trigger vessels_fill_directory
  after insert or update of directory_id, flag, gt, vessel_length, builder, vessel_type, year_built, call_sign
  on public.vessels
  for each row execute function private.vessel_directory_fill_from_crew();

-- Every yacht already in the directory gets its starting entry.
insert into public.vessel_directory_history (directory_id, field, new_value, source, created_at)
select id, 'added', name, coalesce(source, 'crew'), created_at from public.vessel_directory;

-- Wikidata updates. The trigger logs each old and new value.
select set_config('seav.history_source', 'wikidata', true);

update public.vessel_directory set vessel_length = '57', builder = 'Lürssen', updated_at = now() where imo = '1006673';
update public.vessel_directory set vessel_length = '81.2', gt = '2306', updated_at = now() where imo = '1012294';
update public.vessel_directory set vessel_length = '55.18', gt = '891', builder = 'Koninklijke De Vries Scheepsbouw', updated_at = now() where imo = '1010430';
update public.vessel_directory set year_built = '2013', updated_at = now() where imo = '1011109';
update public.vessel_directory set name = 'Northern Star', vessel_length = '75', builder = 'Lürssen-Kröger-Werft', updated_at = now() where imo = '1010129';

insert into public.vessel_directory_history (directory_id, field, old_value, new_value, source)
select id, 'former_name', 'Scout', 'Northern Star', 'wikidata' from public.vessel_directory where imo = '1010129';

select set_config('seav.history_source', '', true);

-- Crew records already linked share any details the directory lacks.
update public.vessels set directory_id = directory_id where directory_id is not null;
