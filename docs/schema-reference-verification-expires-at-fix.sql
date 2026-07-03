-- Hotfix: ambiguous expires_at in request_reference_verification (run in SQL Editor)
-- Safe to re-run.

create or replace function public.request_reference_verification(p_reference_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := auth.uid();
  ref_row public.sea_references%rowtype;
  profile_row public.profile%rowtype;
  plain_token text;
  token_hash text;
  expires_at timestamptz;
  verify_url text;
  crew_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
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

  if crew_email <> '' and lower(trim(ref_row.email)) = crew_email then
    raise exception 'Referee email cannot match your own email';
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
    ref_row.id, uid, token_hash, lower(trim(ref_row.email)), expires_at
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
    'referee_email', lower(trim(ref_row.email)),
    'referee_name', ref_row.name,
    'crew_name', coalesce(profile_row.name, 'SEA-V member'),
    'expires_at', expires_at,
    'verify_url', verify_url,
    'token', plain_token
  );
end;
$$;

revoke all on function public.request_reference_verification(text) from public;
grant execute on function public.request_reference_verification(text) to authenticated;
