-- Two-step login (TOTP 2FA) enforced in the database (v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- Jack asked for two-factor authentication. Supabase Auth issues TOTP
-- factors; after the 6-digit code a session's JWT carries aal = 'aal2'.
-- The page asks for the code, but a page check alone is not protection:
-- someone with only the password could call the REST API directly with an
-- aal1 session. So, per Supabase's documented pattern, every member table
-- gets a RESTRICTIVE policy: a member who has a VERIFIED factor must be on
-- an aal2 session to read or write anything. Members without 2FA are
-- unaffected (aal1 is enough), anon is untouched (policies are
-- `to authenticated`), and the SECURITY DEFINER RPCs that act for a member
-- (delete_own_account, request_reference_verification) check it too.
--
-- private.mfa_satisfied() is SECURITY DEFINER because `authenticated`
-- cannot read auth.mfa_factors. It lives in schema `private`, which
-- PostgREST does not expose, so it is not callable over the API and adds
-- no advisor finding. A missing aal claim is treated as aal1.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated;

drop policy if exists mfa_required on public.achievements;
create policy mfa_required on public.achievements as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.admin_users;
create policy mfa_required on public.admin_users as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.bug_reports;
create policy mfa_required on public.bug_reports as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.certificates;
create policy mfa_required on public.certificates as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.cv_drafts;
create policy mfa_required on public.cv_drafts as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.hobbies_interests;
create policy mfa_required on public.hobbies_interests as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.land_experiences;
create policy mfa_required on public.land_experiences as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.navigation_areas;
create policy mfa_required on public.navigation_areas as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.onboard_experiences;
create policy mfa_required on public.onboard_experiences as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.onboard_skills;
create policy mfa_required on public.onboard_skills as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.payslips;
create policy mfa_required on public.payslips as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.profile;
create policy mfa_required on public.profile as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.sea_references;
create policy mfa_required on public.sea_references as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.seatimes;
create policy mfa_required on public.seatimes as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.specialist_qualifications;
create policy mfa_required on public.specialist_qualifications as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.tenders;
create policy mfa_required on public.tenders as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_required on public.vessels;
create policy mfa_required on public.vessels as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

drop policy if exists mfa_required on storage.objects;
create policy mfa_required on storage.objects as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- The two member-acting definer RPCs bypass RLS, so they check directly.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not private.mfa_satisfied() then
    raise exception 'Enter your two-step login code first';
  end if;

  delete from auth.users where id = uid;
end;
$$;

create or replace function public.request_reference_verification(p_reference_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  uid uuid := auth.uid();
  ref_row public.sea_references%rowtype;
  profile_row public.profile%rowtype;
  plain_token text;
  token_hash text;
  expires_at timestamptz;
  verify_url text;
  crew_email text;
  referee_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not private.mfa_satisfied() then
    raise exception 'Enter your two-step login code first';
  end if;

  select * into ref_row
  from public.sea_references
  where id = p_reference_id and user_id = uid;

  if not found then
    raise exception 'Reference not found';
  end if;

  if coalesce(trim(ref_row.email), '') = '' then
    raise exception 'Referee email is required';
  end if;

  if ref_row.status = 'Verified' then
    raise exception 'Reference is already verified';
  end if;

  select * into profile_row from public.profile where user_id = uid limit 1;
  crew_email := lower(trim(coalesce(profile_row.email, '')));
  referee_email := lower(trim(ref_row.email));

  if crew_email <> '' and referee_email = crew_email then
    raise exception 'Referee email cannot match your own email';
  end if;

  -- v579 rate limits (rolling 24 hours).
  if (select count(*) from public.reference_verification_tokens t
      where t.user_id = uid and t.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have sent 10 verification requests in the last 24 hours. Please try again tomorrow.';
  end if;

  if (select count(*) from public.reference_verification_tokens t
      where t.reference_id = ref_row.id and t.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'This reference has been sent 3 times in the last 24 hours. Please try again tomorrow.';
  end if;

  if (select count(*) from public.reference_verification_tokens t
      where t.sent_to_email = referee_email and t.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'This referee has received several requests today. Please try again tomorrow.';
  end if;

  plain_token := encode(gen_random_bytes(32), 'hex');
  token_hash := public.hash_reference_verification_token(plain_token);
  expires_at := now() + interval '14 days';

  update public.reference_verification_tokens t
  set used_at = now()
  where t.reference_id = ref_row.id
    and t.used_at is null
    and t.expires_at > now();

  insert into public.reference_verification_tokens (
    reference_id, user_id, token_hash, sent_to_email, expires_at
  ) values (
    ref_row.id, uid, token_hash, referee_email, expires_at
  );

  update public.sea_references
  set
    status = 'Sent for Verification',
    updated_at = now()
  where id = ref_row.id;

  verify_url := public.reference_verification_site_url()
    || '/verify-reference.html?token='
    || plain_token;

  return jsonb_build_object(
    'reference_id', ref_row.id,
    'referee_email', referee_email,
    'referee_name', ref_row.name,
    'crew_name', coalesce(profile_row.name, 'SEA-V member'),
    'expires_at', expires_at,
    'verify_url', verify_url,
    'token', plain_token
  );
end;
$function$;

-- SMOKE TEST 2026-10-08 (real authenticated role, rolled back; a stand-in
-- verified TOTP factor inserted into auth.mfa_factors for the test only):
--   member WITHOUT 2FA, aal1:    certificates 22            (unchanged)
--   same member WITH 2FA, aal1:  certificates 0, files 0,
--                                delete_own_account -> "Enter your two-step login code first",
--                                insert -> violates row-level security policy "mfa_required"
--   same member WITH 2FA, aal2:  certificates 22, files 26
--   anon: get_public_profile 200; test-supabase.mjs --step all passes.
--   Security advisors 23 / 23 (private schema is not API-exposed).
