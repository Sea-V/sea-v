-- Hotfix: ambiguous token_hash in preview/complete RPCs (re-run in SQL Editor)
-- Safe to run after docs/schema-reference-verification.sql

create or replace function public.preview_reference_verification(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_token_hash text;
  token_row public.reference_verification_tokens%rowtype;
  ref_row public.sea_references%rowtype;
  profile_row public.profile%rowtype;
  vessel_name text;
begin
  if coalesce(trim(p_token), '') = '' then
    raise exception 'Missing token';
  end if;

  v_token_hash := public.hash_reference_verification_token(trim(p_token));

  select * into token_row
  from public.reference_verification_tokens t
  where t.token_hash = v_token_hash
  limit 1;

  if not found then
    raise exception 'Invalid or expired verification link';
  end if;

  if token_row.used_at is not null then
    raise exception 'This verification link has already been used';
  end if;

  if token_row.expires_at <= now() then
    raise exception 'This verification link has expired';
  end if;

  select * into ref_row from public.sea_references where id = token_row.reference_id;
  if not found then
    raise exception 'Reference not found';
  end if;

  select * into profile_row
  from public.profile p
  where p.user_id = ref_row.user_id or p.id = ref_row.user_id::text
  limit 1;

  select v.name into vessel_name
  from public.vessels v
  where v.id = ref_row.vessel_id
  limit 1;

  return jsonb_build_object(
    'reference_id', ref_row.id,
    'status', ref_row.status,
    'crew_name', coalesce(profile_row.name, 'SEA-V member'),
    'referee_name', ref_row.name,
    'referee_title', ref_row.title,
    'referee_email', token_row.sent_to_email,
    'vessel_name', coalesce(vessel_name, ''),
    'crew_role', ref_row.role,
    'service_period', ref_row.period,
    'reference_text', ref_row.reference_text,
    'reference_date', ref_row.reference_date,
    'expires_at', token_row.expires_at
  );
end;
$$;

create or replace function public.complete_reference_verification(
  p_token text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_token_hash text;
  token_row public.reference_verification_tokens%rowtype;
  ref_row public.sea_references%rowtype;
  confirmed boolean := coalesce((p_payload->>'confirmed')::boolean, false);
  signature_name text := trim(coalesce(p_payload->>'signatureName', ''));
  verifier_rank text := trim(coalesce(p_payload->>'rank', ''));
  coc_number text := trim(coalesce(p_payload->>'cocNumber', ''));
  note_text text := trim(coalesce(p_payload->>'note', ''));
  signed_at text := trim(coalesce(p_payload->>'signedAt', ''));
  new_status text;
  v_verification jsonb;
begin
  if coalesce(trim(p_token), '') = '' then
    raise exception 'Missing token';
  end if;

  v_token_hash := public.hash_reference_verification_token(trim(p_token));

  select * into token_row
  from public.reference_verification_tokens t
  where t.token_hash = v_token_hash
  limit 1;

  if not found then
    raise exception 'Invalid or expired verification link';
  end if;

  if token_row.used_at is not null then
    raise exception 'This verification link has already been used';
  end if;

  if token_row.expires_at <= now() then
    raise exception 'This verification link has expired';
  end if;

  select * into ref_row from public.sea_references where id = token_row.reference_id;
  if not found then
    raise exception 'Reference not found';
  end if;

  if confirmed and signature_name = '' then
    raise exception 'Signature (full name) is required to confirm';
  end if;

  new_status := case when confirmed then 'Verified' else 'Declined' end;

  v_verification := jsonb_build_object(
    'confirmed', confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', note_text,
    'rank', coalesce(nullif(verifier_rank, ''), ref_row.title, ''),
    'cocNumber', coc_number,
    'signatureName', signature_name,
    'signedAt', coalesce(nullif(signed_at, ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD')),
    'completedAt', now()
  );

  update public.sea_references
  set
    status = new_status,
    verification = v_verification,
    updated_at = now()
  where id = ref_row.id;

  update public.reference_verification_tokens
  set used_at = now()
  where id = token_row.id;

  return jsonb_build_object(
    'reference_id', ref_row.id,
    'status', new_status,
    'confirmed', confirmed
  );
end;
$$;

revoke all on function public.preview_reference_verification(text) from public;
grant execute on function public.preview_reference_verification(text) to anon, authenticated;

revoke all on function public.complete_reference_verification(text, jsonb) from public;
grant execute on function public.complete_reference_verification(text, jsonb) to anon, authenticated;
