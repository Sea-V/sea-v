-- Reference verification — drawn signature upload + complete v3
-- Run in Supabase SQL Editor after schema-reference-verification-v2-complete.sql
-- Safe to re-run

-- Path format: verification-signatures/{reference_id}/{token_uuid}.png

create or replace function public.prepare_reference_verification_signature(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_token_hash text;
  token_row public.reference_verification_tokens%rowtype;
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

  return jsonb_build_object(
    'bucket', 'reference-files',
    'path', 'verification-signatures/' || token_row.reference_id || '/' || token_row.id::text || '.png',
    'reference_id', token_row.reference_id,
    'token_id', token_row.id
  );
end;
$$;

revoke all on function public.prepare_reference_verification_signature(text) from public;
grant execute on function public.prepare_reference_verification_signature(text) to anon, authenticated;

create or replace function public.reference_verification_allows_signature_write(p_object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.reference_verification_tokens t
    where t.used_at is null
      and t.expires_at > now()
      and p_object_path = 'verification-signatures/' || t.reference_id || '/' || t.id::text || '.png'
  );
$$;

revoke all on function public.reference_verification_allows_signature_write(text) from public;
grant execute on function public.reference_verification_allows_signature_write(text) to anon, authenticated;

create or replace function public.reference_verification_allows_signature_read(p_object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.sea_references r
    where coalesce(r.verification->'signatureImage'->>'path', '') = p_object_path
      and (
        auth.uid() is null
        or r.user_id = auth.uid()
      )
  );
$$;

revoke all on function public.reference_verification_allows_signature_read(text) from public;
grant execute on function public.reference_verification_allows_signature_read(text) to anon, authenticated;

drop policy if exists reference_files_verification_signature_insert on storage.objects;
drop policy if exists reference_files_verification_signature_read on storage.objects;

create policy reference_files_verification_signature_insert
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'reference-files'
    and public.reference_verification_allows_signature_write(name)
  );

create policy reference_files_verification_signature_update
  on storage.objects for update to anon, authenticated
  using (
    bucket_id = 'reference-files'
    and public.reference_verification_allows_signature_write(name)
  )
  with check (
    bucket_id = 'reference-files'
    and public.reference_verification_allows_signature_write(name)
  );

create policy reference_files_verification_signature_read
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'reference-files'
    and public.reference_verification_allows_signature_read(name)
  );

create or replace function public.complete_reference_verification_v3(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  p_token text := trim(coalesce(p_request->>'token', ''));
  p_payload jsonb := coalesce(p_request->'payload', '{}'::jsonb);
  v_token_hash text;
  token_row public.reference_verification_tokens%rowtype;
  ref_row public.sea_references%rowtype;
  v_confirmed boolean := coalesce((p_payload->>'confirmed')::boolean, false);
  v_signature_name text := trim(coalesce(p_payload->>'signatureName', ''));
  v_verifier_rank text := trim(coalesce(p_payload->>'rank', ''));
  v_coc_number text := trim(coalesce(p_payload->>'cocNumber', ''));
  v_note_text text := trim(coalesce(p_payload->>'note', ''));
  v_signed_at text := trim(coalesce(p_payload->>'signedAt', ''));
  v_signature_image jsonb := null;
  v_new_status text;
  v_verification jsonb;
  v_result jsonb;
begin
  if p_token = '' then
    raise exception 'Missing token';
  end if;

  v_token_hash := public.hash_reference_verification_token(p_token);

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

  select * into ref_row
  from public.sea_references r
  where r.id = token_row.reference_id
  limit 1;

  if not found then
    raise exception 'Reference not found';
  end if;

  if v_confirmed and v_signature_name = '' then
    raise exception 'Signature (full name) is required to confirm';
  end if;

  if p_payload ? 'signatureImage' and p_payload->'signatureImage' is not null then
    v_signature_image := p_payload->'signatureImage';
  end if;

  if v_confirmed and v_signature_image is null then
    raise exception 'Drawn signature is required to confirm';
  end if;

  if v_signature_image is not null then
    if coalesce(v_signature_image->>'path', '') = '' then
      raise exception 'Invalid signature image metadata';
    end if;

    if v_signature_image->>'path'
      <> 'verification-signatures/' || token_row.reference_id || '/' || token_row.id::text || '.png' then
      raise exception 'Signature path does not match this verification link';
    end if;
  end if;

  v_new_status := case when v_confirmed then 'Verified' else 'Declined' end;

  v_verification := jsonb_build_object(
    'confirmed', v_confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', v_note_text,
    'rank', coalesce(nullif(v_verifier_rank, ''), ref_row.title, ''),
    'cocNumber', v_coc_number,
    'signatureName', v_signature_name,
    'signatureImage', v_signature_image,
    'signedAt', coalesce(nullif(v_signed_at, ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD')),
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.sea_references r
  set
    status = v_new_status,
    verification = v_verification,
    updated_at = now()
  where r.id = ref_row.id;

  update public.reference_verification_tokens t
  set used_at = now()
  where t.id = token_row.id;

  v_result := jsonb_build_object(
    'reference_id', ref_row.id,
    'status', v_new_status,
    'confirmed', v_confirmed
  );

  return v_result;
end;
$$;

revoke all on function public.complete_reference_verification_v3(jsonb) from public;
grant execute on function public.complete_reference_verification_v3(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
