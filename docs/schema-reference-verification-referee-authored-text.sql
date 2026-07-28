-- Reference verification — referee-authored reference text
-- Run in Supabase SQL Editor after schema-reference-verification-block-self-signing.sql
-- Safe to re-run
--
-- Reference text used to be typed by the crew member when adding the
-- reference (self-reported), which defeats the point of a third-party
-- reference. From here on: the crew member only supplies a short optional
-- "message to referee" (context/instructions, references.html rf_message),
-- and the referee writes the actual reference_text themselves on the verify
-- page (verify-reference.html vrReferenceText), along with the date
-- (reference_date, reusing the existing signed-date field) and their
-- signature. Required to confirm, same as signature name/image; left
-- untouched on decline (nothing to show if declined).
--
-- Editing a reference that's already under verification (Sent/Verified/
-- Declined) still voids it back to Draft client-side (js/references.js) and
-- now also clears the old referee-authored text/date along with the
-- verification data, since it belonged to the now-invalidated round.

alter table public.sea_references
  add column if not exists message_to_referee text;

create or replace function public.preview_reference_verification(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
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
    'message_to_referee', ref_row.message_to_referee,
    'reference_text', ref_row.reference_text,
    'reference_date', ref_row.reference_date,
    'attachment', ref_row.attachment,
    'expires_at', token_row.expires_at
  );
end;
$function$;

create or replace function public.complete_reference_verification_v3(p_request jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
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
  v_reference_text text := trim(coalesce(p_payload->>'referenceText', ''));
  v_signature_image jsonb := null;
  v_new_status text;
  v_verification jsonb;
  v_new_reference_date text;
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

  if auth.uid() is not null and auth.uid() = token_row.user_id then
    raise exception 'You cannot verify your own reference — ask your referee to open the link and confirm it themselves.';
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

  if v_confirmed and v_reference_text = '' then
    raise exception 'Please write the reference before confirming';
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
  v_new_reference_date := coalesce(nullif(v_signed_at, ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD'));

  v_verification := jsonb_build_object(
    'confirmed', v_confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', v_note_text,
    'rank', coalesce(nullif(v_verifier_rank, ''), ref_row.title, ''),
    'cocNumber', v_coc_number,
    'signatureName', v_signature_name,
    'signatureImage', v_signature_image,
    'signedAt', v_new_reference_date,
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.sea_references r
  set
    status = v_new_status,
    verification = v_verification,
    reference_text = case when v_confirmed then v_reference_text else r.reference_text end,
    reference_date = case when v_confirmed then v_new_reference_date else r.reference_date end,
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
$function$;

create or replace function public.complete_reference_verification_v2(p_request jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
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
  v_reference_text text := trim(coalesce(p_payload->>'referenceText', ''));
  v_new_status text;
  v_verification jsonb;
  v_new_reference_date text;
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

  if auth.uid() is not null and auth.uid() = token_row.user_id then
    raise exception 'You cannot verify your own reference — ask your referee to open the link and confirm it themselves.';
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

  if v_confirmed and v_reference_text = '' then
    raise exception 'Please write the reference before confirming';
  end if;

  v_new_status := case when v_confirmed then 'Verified' else 'Declined' end;
  v_new_reference_date := coalesce(nullif(v_signed_at, ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD'));

  v_verification := jsonb_build_object(
    'confirmed', v_confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', v_note_text,
    'rank', coalesce(nullif(v_verifier_rank, ''), ref_row.title, ''),
    'cocNumber', v_coc_number,
    'signatureName', v_signature_name,
    'signedAt', v_new_reference_date,
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.sea_references r
  set
    status = v_new_status,
    verification = v_verification,
    reference_text = case when v_confirmed then v_reference_text else r.reference_text end,
    reference_date = case when v_confirmed then v_new_reference_date else r.reference_date end,
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
$function$;

create or replace function public.complete_reference_verification(p_token text, p_payload jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
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
  reference_text_in text := trim(coalesce(p_payload->>'referenceText', ''));
  new_status text;
  v_verification jsonb;
  new_reference_date text;
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

  if auth.uid() is not null and auth.uid() = token_row.user_id then
    raise exception 'You cannot verify your own reference — ask your referee to open the link and confirm it themselves.';
  end if;

  select * into ref_row from public.sea_references where id = token_row.reference_id;
  if not found then
    raise exception 'Reference not found';
  end if;

  if confirmed and signature_name = '' then
    raise exception 'Signature (full name) is required to confirm';
  end if;

  if confirmed and reference_text_in = '' then
    raise exception 'Please write the reference before confirming';
  end if;

  new_status := case when confirmed then 'Verified' else 'Declined' end;
  new_reference_date := coalesce(nullif(signed_at, ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD'));

  v_verification := jsonb_build_object(
    'confirmed', confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', note_text,
    'rank', coalesce(nullif(verifier_rank, ''), ref_row.title, ''),
    'cocNumber', coc_number,
    'signatureName', signature_name,
    'signedAt', new_reference_date,
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.sea_references
  set
    status = new_status,
    verification = v_verification,
    reference_text = case when confirmed then reference_text_in else reference_text end,
    reference_date = case when confirmed then new_reference_date else reference_date end,
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
$function$;
