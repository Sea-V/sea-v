-- v586 (2026-10-09): nautical miles and owner / guest days on sea time.
--
-- Jack: "add miles" and "owner/guest onboard days in seatime". Neither is an
-- MCA figure (MSN 1858 counts sea / standby / yard / watchkeeping), but
-- miles are asked for on Yachtmaster and IYT testimonials, and guest days
-- show charter / owner-trip experience to employers.
--   * seatimes.nautical_miles   integer 0..200000, null = not recorded
--   * seatimes.owner_guest_days integer 0..5000,   null = not recorded
-- Private: authenticated has table-level grants on seatimes, so the member
-- can read/write both; anon's SELECT is column-scoped and is NOT extended
-- (nothing on the public profile reads them).
-- The captain's testimonial now shows and confirms both (preview +
-- complete), and editing either on a Confirmed entry marks it 'Changed'.
-- The edge function sea-testimonial passes p_response through unchanged,
-- so no redeploy is needed.
--
-- APPLIED 2026-10-09 as migration seatimes_miles_owner_guest. SMOKE TEST
-- (rolled back): 24 seatime rows unchanged; member (authenticated role)
-- writes 1234 NM / 40 days and reads them back; -5 NM refused (check);
-- testimonial request -> preview shows miles 1234 / owner_guest 40 ->
-- confirm with miles '1300', owner_guest 'x' -> confirmed 1300 / 40 (junk
-- falls back to logged); member edits miles on the Confirmed row ->
-- 'Changed'. curl as anon: both columns 42501. Advisors 23/23.
-- test-supabase.mjs probes both columns as private.

alter table public.seatimes
  add column if not exists nautical_miles integer,
  add column if not exists owner_guest_days integer;

alter table public.seatimes drop constraint if exists seatimes_nautical_miles_range;
alter table public.seatimes add constraint seatimes_nautical_miles_range
  check (nautical_miles is null or nautical_miles between 0 and 200000);
alter table public.seatimes drop constraint if exists seatimes_owner_guest_days_range;
alter table public.seatimes add constraint seatimes_owner_guest_days_range
  check (owner_guest_days is null or owner_guest_days between 0 and 5000);

create or replace function public.guard_seatime_testimonial()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.testimonial := null;
    new.testimonial_status := null;
    return new;
  end if;

  if new.testimonial is distinct from old.testimonial then
    new.testimonial := old.testimonial;
  end if;

  if new.testimonial_status is distinct from old.testimonial_status then
    if not (old.testimonial_status = 'Sent' and new.testimonial_status is null) then
      new.testimonial_status := old.testimonial_status;
    end if;
  end if;

  if old.testimonial_status = 'Confirmed' and (
       new.date_joined is distinct from old.date_joined
    or new.date_left is distinct from old.date_left
    or new.capacity_served is distinct from old.capacity_served
    or new.vessel_id is distinct from old.vessel_id
    or new.actual_sea_service_days is distinct from old.actual_sea_service_days
    or new.standby_service_days is distinct from old.standby_service_days
    or new.yard_service_days is distinct from old.yard_service_days
    or new.watchkeeping_days is distinct from old.watchkeeping_days
    or new.nautical_miles is distinct from old.nautical_miles
    or new.owner_guest_days is distinct from old.owner_guest_days
  ) then
    new.testimonial_status := 'Changed';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_seatime_testimonial() from public, anon, authenticated;

create or replace function public.testimonial_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  tok public.testimonial_tokens%rowtype;
  st public.seatimes%rowtype;
  v public.vessels%rowtype;
  prof public.profile%rowtype;
begin
  select * into tok from public.testimonial_tokens
  where token_hash = public.hash_reference_verification_token(coalesce(p_token, ''));
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  if tok.used_at is not null then return jsonb_build_object('state', 'used'); end if;
  if tok.expires_at < now() then return jsonb_build_object('state', 'expired'); end if;

  select * into st from public.seatimes where id = tok.seatime_id and user_id = tok.user_id;
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  select * into v from public.vessels where id = st.vessel_id and user_id = tok.user_id;
  select * into prof from public.profile where user_id = tok.user_id limit 1;

  return jsonb_build_object(
    'state', 'open',
    'master_name', tok.master_name,
    'master_email', tok.sent_to_email,
    'crew', jsonb_build_object(
      'name', coalesce(prof.name, ''),
      'dob', coalesce(prof.dob, ''),
      'nationality', coalesce(prof.nationality, ''),
      'discharge_book', coalesce(prof.discharge_book_number, '')
    ),
    'vessel', jsonb_build_object(
      'name', coalesce(v.name, ''),
      'type', coalesce(nullif(v.vessel_type, ''), v.type, ''),
      'flag', coalesce(nullif(st.flag, ''), v.flag, ''),
      'gt', coalesce(nullif(st.gt, ''), v.gt, ''),
      'length', coalesce(v.vessel_length, ''),
      'official_number', coalesce(nullif(v.official_number, ''), st.imo_official_number, ''),
      'imo', coalesce(v.imo, ''),
      'engine_kw', coalesce(v.engine_kw, '')
    ),
    'service', jsonb_build_object(
      'capacity', coalesce(st.capacity_served, ''),
      'date_joined', st.date_joined,
      'date_left', st.date_left,
      'actual_sea', coalesce(st.actual_sea_service_days, 0),
      'standby', coalesce(st.standby_service_days, 0),
      'yard', coalesce(st.yard_service_days, 0),
      'watchkeeping', coalesce(st.watchkeeping_days, 0),
      'owner_guest', coalesce(st.owner_guest_days, 0),
      'miles', coalesce(st.nautical_miles, 0)
    )
  );
end;
$$;
revoke all on function public.testimonial_preview(text) from public, anon, authenticated;
grant execute on function public.testimonial_preview(text) to service_role;

create or replace function public.testimonial_complete(p_token text, p_response jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  preview jsonb := public.testimonial_preview(p_token);
  tok public.testimonial_tokens%rowtype;
  decision text := coalesce(p_response ->> 'decision', '');
  f jsonb := coalesce(p_response -> 'figures', '{}'::jsonb);
  svc jsonb;
  rec jsonb;
  clip int := 1000;
begin
  if preview ->> 'state' <> 'open' then
    raise exception 'This link is no longer valid';
  end if;
  select * into tok from public.testimonial_tokens
  where token_hash = public.hash_reference_verification_token(p_token);

  if decision = 'decline' then
    rec := jsonb_build_object(
      'decision', 'declined',
      'master_name', left(coalesce(p_response ->> 'master_name', tok.master_name, ''), 120),
      'master_email', tok.sent_to_email,
      'reason', left(coalesce(p_response ->> 'decline_reason', ''), 500),
      'answered_at', now()
    );
    update public.seatimes set testimonial = rec, testimonial_status = 'Declined', updated_at = now()
    where id = tok.seatime_id;
  elsif decision = 'confirm' then
    if coalesce(trim(p_response ->> 'signature'), '') = '' or coalesce(trim(p_response ->> 'master_name'), '') = '' then
      raise exception 'Add your name and signature';
    end if;
    svc := preview -> 'service';
    rec := jsonb_build_object(
      'decision', 'confirmed',
      'master_name', left(trim(p_response ->> 'master_name'), 120),
      'master_email', tok.sent_to_email,
      'master_rank', left(coalesce(p_response ->> 'master_rank', ''), 60),
      'coc_number', left(coalesce(p_response ->> 'coc_number', ''), 60),
      'coc_grade', left(coalesce(p_response ->> 'coc_grade', ''), 120),
      'signature', left(trim(p_response ->> 'signature'), 120),
      'comment', left(coalesce(p_response ->> 'comment', ''), 500),
      'answered_at', now(),
      'crew', preview -> 'crew',
      'vessel', preview -> 'vessel',
      'logged', svc,
      'confirmed', jsonb_build_object(
        'capacity', svc ->> 'capacity',
        'date_joined', svc ->> 'date_joined',
        'date_left', svc ->> 'date_left',
        'actual_sea', least(greatest(case when (f ->> 'actual_sea') ~ '^\d{1,4}$' then (f ->> 'actual_sea')::int else (svc ->> 'actual_sea')::int end, 0), clip),
        'standby', least(greatest(case when (f ->> 'standby') ~ '^\d{1,4}$' then (f ->> 'standby')::int else (svc ->> 'standby')::int end, 0), clip),
        'yard', least(greatest(case when (f ->> 'yard') ~ '^\d{1,4}$' then (f ->> 'yard')::int else (svc ->> 'yard')::int end, 0), clip),
        'watchkeeping', least(greatest(case when (f ->> 'watchkeeping') ~ '^\d{1,4}$' then (f ->> 'watchkeeping')::int else (svc ->> 'watchkeeping')::int end, 0), clip),
        'owner_guest', least(greatest(case when (f ->> 'owner_guest') ~ '^\d{1,4}$' then (f ->> 'owner_guest')::int else coalesce((svc ->> 'owner_guest')::int, 0) end, 0), clip),
        'miles', least(greatest(case when (f ->> 'miles') ~ '^\d{1,6}$' then (f ->> 'miles')::int else coalesce((svc ->> 'miles')::int, 0) end, 0), 200000)
      )
    );
    update public.seatimes set testimonial = rec, testimonial_status = 'Confirmed', updated_at = now()
    where id = tok.seatime_id;
  else
    raise exception 'Choose confirm or decline';
  end if;

  update public.testimonial_tokens set used_at = now() where id = tok.id;

  return jsonb_build_object('ok', true, 'decision', rec ->> 'decision',
    'user_id', tok.user_id, 'crew_name', preview -> 'crew' ->> 'name');
end;
$$;
revoke all on function public.testimonial_complete(text, jsonb) from public, anon, authenticated;
grant execute on function public.testimonial_complete(text, jsonb) to service_role;
