-- Sea service testimonials confirmed online by the captain (v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- "Next level" idea 1. A crew member sends one sea time entry to the
-- master; the master opens a single-use link (verify-testimonial.html),
-- checks the pre-filled testimonial, may correct the day counts, adds their
-- CoC details and a typed signature, and confirms or declines. The member
-- can then print a completed testimonial. MCA: for a Notice of Eligibility
-- large-yacht service must still be verified by the PYA or Nautilus
-- (MIN 543) — the page and the printout say so; SEA-V prepares and records,
-- it does not replace that verification.
--
-- Every step runs through edge function `sea-testimonial` with the service
-- role. The three RPCs below are service_role ONLY, so no new function is
-- callable by anon/authenticated (no new advisor findings) — the member's
-- JWT (incl. two-step login) is checked in the function.

-- 1. What the master confirmed, and where the request stands. Private:
--    seatimes' anon grant is column-scoped and these are not granted, nor
--    in PUBLIC_ARRAY_COLUMNS.
alter table public.seatimes
  add column if not exists testimonial jsonb,
  add column if not exists testimonial_status text;

alter table public.seatimes drop constraint if exists seatimes_testimonial_status_check;
alter table public.seatimes add constraint seatimes_testimonial_status_check
  check (testimonial_status is null or testimonial_status in ('Sent', 'Confirmed', 'Declined', 'Changed'));

-- 2. Single-use links.
create table if not exists public.testimonial_tokens (
  id uuid primary key default gen_random_uuid(),
  seatime_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  sent_to_email text not null,
  master_name text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.testimonial_tokens enable row level security;
revoke all on public.testimonial_tokens from anon;
drop policy if exists testimonial_tokens_owner_select on public.testimonial_tokens;
create policy testimonial_tokens_owner_select on public.testimonial_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists mfa_required on public.testimonial_tokens;
create policy mfa_required on public.testimonial_tokens as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- 3. Members cannot write the confirmation themselves. They may cancel a
--    pending request (Sent -> null). Editing what was confirmed (dates,
--    days, capacity, vessel) flips Confirmed -> Changed automatically; the
--    master's record is kept for history.
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
  ) then
    new.testimonial_status := 'Changed';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_seatime_testimonial() from public, anon, authenticated;

drop trigger if exists seatimes_testimonial_guard on public.seatimes;
create trigger seatimes_testimonial_guard
  before insert or update on public.seatimes
  for each row execute function public.guard_seatime_testimonial();

-- 4. Member asks: called by the function AFTER it has checked the member's
--    JWT (and two-step login). Limits per rolling 24h: 10 per member,
--    3 per entry, 5 per master address.
create or replace function public.testimonial_request(
  p_user_id uuid, p_seatime_id text, p_master_name text, p_master_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st public.seatimes%rowtype;
  v public.vessels%rowtype;
  prof public.profile%rowtype;
  email text := lower(trim(coalesce(p_master_email, '')));
  plain text;
begin
  select * into st from public.seatimes where id = p_seatime_id and user_id = p_user_id;
  if not found then raise exception 'Sea time entry not found'; end if;
  if email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter the captain''s email address'; end if;
  if coalesce(trim(p_master_name), '') = '' then raise exception 'Enter the captain''s name'; end if;
  if coalesce(st.date_joined, '') = '' or coalesce(st.date_left, '') = '' then
    raise exception 'Add the dates you joined and left before asking for a signature';
  end if;

  select * into prof from public.profile where user_id = p_user_id limit 1;
  if email = lower(trim(coalesce(prof.email, ''))) then
    raise exception 'The captain''s email cannot be your own';
  end if;

  if (select count(*) from public.testimonial_tokens t where t.user_id = p_user_id and t.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have sent 10 requests in the last 24 hours. Please try again tomorrow.';
  end if;
  if (select count(*) from public.testimonial_tokens t where t.seatime_id = st.id and t.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'This entry has been sent 3 times in the last 24 hours. Please try again tomorrow.';
  end if;
  if (select count(*) from public.testimonial_tokens t where t.sent_to_email = email and t.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'This captain has received several requests today. Please try again tomorrow.';
  end if;

  update public.testimonial_tokens set used_at = now()
  where seatime_id = st.id and used_at is null and expires_at > now();

  plain := encode(gen_random_bytes(32), 'hex');
  insert into public.testimonial_tokens (seatime_id, user_id, token_hash, sent_to_email, master_name, expires_at)
  values (st.id, p_user_id, public.hash_reference_verification_token(plain), email, trim(p_master_name), now() + interval '14 days');

  update public.seatimes set testimonial_status = 'Sent', updated_at = now() where id = st.id;

  select * into v from public.vessels where id = st.vessel_id and user_id = p_user_id;

  return jsonb_build_object(
    'verify_url', public.reference_verification_site_url() || '/verify-testimonial.html?token=' || plain,
    'master_email', email,
    'master_name', trim(p_master_name),
    'crew_name', coalesce(nullif(prof.name, ''), 'A SEA-V member'),
    'vessel_name', coalesce(v.name, ''),
    'date_joined', st.date_joined,
    'date_left', st.date_left
  );
end;
$$;
revoke all on function public.testimonial_request(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.testimonial_request(uuid, text, text, text) to service_role;

-- 5. Master opens the link: everything the testimonial shows.
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
      'watchkeeping', coalesce(st.watchkeeping_days, 0)
    )
  );
end;
$$;
revoke all on function public.testimonial_preview(text) from public, anon, authenticated;
grant execute on function public.testimonial_preview(text) to service_role;

-- 6. Master answers. p_response: { decision: 'confirm'|'decline',
--    master_name, master_rank, coc_number, coc_grade, signature, comment,
--    decline_reason, figures: { actual_sea, standby, yard, watchkeeping } }
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
        'watchkeeping', least(greatest(case when (f ->> 'watchkeeping') ~ '^\d{1,4}$' then (f ->> 'watchkeeping')::int else (svc ->> 'watchkeeping')::int end, 0), clip)
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

-- Follow-up migration retention_cleanup_testimonial_links (same day):
-- run_retention_cleanup() also deletes testimonial_tokens 90 days after
-- they expire (see docs/schema-retention-cleanup.sql for the rest).

-- SMOKE TEST 2026-10-08:
--   SQL (rolled back, real authenticated role for the member parts):
--     request -> preview 'open' (Senses / Jack Sorrell); bad email refused;
--     confirm with figures {actual_sea '42', standby 'x', watchkeeping '5'}
--       -> Confirmed, confirmed.actual_sea 42 (logged 15), standby falls
--          back to logged (junk input), watchkeeping 5; link reuse -> 'used'
--     member UPDATE testimonial/status -> ignored (record kept);
--     member edits days on a Confirmed row -> 'Changed';
--     member sets null -> Confirmed on a fresh row -> stays null;
--     member INSERT with status/testimonial -> both null;
--     member cancels Sent -> null allowed.
--   LIVE, end to end (demo account, then reverted to null / 0 tokens):
--     edge function sea-testimonial: request without JWT 401; bad token
--     preview {state invalid}; complete with bad token 400;
--     verify-testimonial.html with a real link rendered crew / vessel /
--     service from the live data; confirm blocked without the tick; confirm
--     with 470 (logged 480) -> Confirmed, member's own figure unchanged;
--     reopening -> "already answered".
--   Not tried: a real captain email (Resend) — only demo / refused paths.
