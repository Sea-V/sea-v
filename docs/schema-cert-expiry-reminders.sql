-- Certificate expiry reminder emails (v579, 2026-10-08 — "next level" idea 4)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
-- THE DAILY JOB IS CREATED INACTIVE: it sends real email to real members,
-- so it is switched on only when Jack says so:
--   select cron.alter_job((select jobid from cron.job where jobname = 'seav-cert-reminders'), active := true);
--
-- One digest email per member, from edge function `cert-reminders`, for
-- certificates expiring within 90 days, and again within 30. Each sent
-- reminder is logged per (certificate, kind, expiry date), so nothing is
-- sent twice and a renewed certificate (new expiry) starts afresh.
-- Service email about the member's own account — legitimate interests,
-- on by default, switched off in Profile settings (profile.expiry_reminders).
--
-- Who can trigger it: pg_cron calls the function with a random token kept
-- in Vault (`seav_cron_token`); the function checks it through
-- verify_cron_token(), which only service_role may execute. The helper
-- RPCs are SECURITY DEFINER but EXECUTE is revoked from public / anon /
-- authenticated, so they are not reachable over the API.

-- 1. Opt-out switch (private: anon's profile SELECT is column-scoped and
--    this column is not granted).
alter table public.profile
  add column if not exists expiry_reminders boolean not null default true;

-- 2. What has been sent.
create table if not exists public.cert_reminder_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  certificate_id text not null,
  kind text not null check (kind in ('90', '30')),
  expiry_date text not null,
  sent_at timestamptz not null default now(),
  unique (certificate_id, kind, expiry_date)
);
alter table public.cert_reminder_log enable row level security;
revoke all on public.cert_reminder_log from anon;
drop policy if exists cert_reminder_log_owner_select on public.cert_reminder_log;
create policy cert_reminder_log_owner_select on public.cert_reminder_log
  for select to authenticated using (user_id = auth.uid());
drop policy if exists mfa_required on public.cert_reminder_log;
create policy mfa_required on public.cert_reminder_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- 3. Cron token in Vault (created once).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'seav_cron_token') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'seav_cron_token', 'pg_cron -> edge functions');
  end if;
end $$;

create or replace function public.verify_cron_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_token, '') <> ''
     and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'seav_cron_token');
$$;
revoke all on function public.verify_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_cron_token(text) to service_role;

-- 4. Reminders due now, not yet sent.
create or replace function public.due_cert_reminders()
returns table (
  user_id uuid,
  email text,
  first_name text,
  certificate_id text,
  cert_name text,
  expiry_date text,
  days_left integer,
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  with due as (
    select
      c.user_id,
      c.id as certificate_id,
      coalesce(nullif(trim(c.name), ''), c.code, 'Certificate') as cert_name,
      c.expiry_date,
      (c.expiry_date::date - current_date) as days_left,
      case when c.expiry_date::date - current_date <= 30 then '30' else '90' end as kind
    from public.certificates c
    where c.expiry_date ~ '^\d{4}-\d{2}-\d{2}$'
      and not coalesce(c.is_template, false)
      and c.expiry_date::date between current_date and current_date + 90
  )
  select d.user_id, u.email::text,
         coalesce(nullif(trim(p.first_name), ''), split_part(coalesce(p.name, ''), ' ', 1), ''),
         d.certificate_id, d.cert_name, d.expiry_date, d.days_left, d.kind
  from due d
  join auth.users u on u.id = d.user_id
  left join public.profile p on p.user_id = d.user_id
  where coalesce(p.expiry_reminders, true)
    and u.email is not null
    and u.email_confirmed_at is not null
    -- Demo accounts have made-up addresses: mail would bounce and hurt
    -- the sea-v.com sending reputation. (Applied as a second migration,
    -- cert_reminders_skip_demo, after the dry run found one.)
    and u.email not ilike '%@sea-v-demo.com'
    and not exists (
      select 1 from public.cert_reminder_log l
      where l.certificate_id = d.certificate_id
        and l.kind = d.kind
        and l.expiry_date = d.expiry_date
    )
  order by d.user_id, d.days_left;
$$;
revoke all on function public.due_cert_reminders() from public, anon, authenticated;
grant execute on function public.due_cert_reminders() to service_role;

-- 5. Record what was sent (called by the function after Resend accepts).
create or replace function public.log_cert_reminders(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.cert_reminder_log (user_id, certificate_id, kind, expiry_date)
  select r.user_id, r.certificate_id, r.kind, r.expiry_date
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
       as r(user_id uuid, certificate_id text, kind text, expiry_date text)
  on conflict (certificate_id, kind, expiry_date) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.log_cert_reminders(jsonb) from public, anon, authenticated;
grant execute on function public.log_cert_reminders(jsonb) to service_role;

-- 6. Daily 06:00 UTC (07:00 UK summer time) — created INACTIVE.
select cron.unschedule(jobid) from cron.job where jobname = 'seav-cert-reminders';
select cron.schedule(
  'seav-cert-reminders',
  '0 6 * * *',
  $job$
    select net.http_post(
      url := 'https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/cert-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-seav-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'seav_cron_token')
      ),
      body := '{}'::jsonb
    );
  $job$
);
select cron.alter_job((select jobid from cron.job where jobname = 'seav-cert-reminders'), active := false);

-- SMOKE TEST 2026-10-08:
--   job seav-cert-reminders exists, schedule '0 6 * * *', active = FALSE
--   edge function cert-reminders (verify_jwt false) deployed v1:
--     no token -> 401; wrong token -> 401
--     dry run via pg_net with the Vault token -> 200
--       {members 1, certificates 1: ENG1 25 days, kind '30'} — a demo
--       account (@sea-v-demo.com), now excluded; due_now after = 0
--   cert_reminder_log rows: 0 (dry run logs nothing)
--   anon/authenticated EXECUTE on the three RPCs: false;
--   anon SELECT on profile.expiry_reminders: false.
-- Real sending NOT tried — no live email has been sent.
