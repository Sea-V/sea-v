-- Reference verification — block self-signing
-- Run in Supabase SQL Editor after schema-reference-verification-signature.sql
-- Safe to re-run
--
-- Bug: complete_reference_verification / _v2 / _v3 never checked WHO was
-- completing a token — only that it was valid, unused, and unexpired. The
-- crew member who creates a reference gets the real, live, single-use
-- verify_url back directly (request_reference_verification's return value),
-- and the "Preview link" button in the share-link dialog opened that exact
-- URL. Since verify-reference.html has only one rendering state (the full
-- interactive confirm/decline form — there's no separate read-only view),
-- the crew member could just fill it out and self-verify their own
-- reference. Fixed on the client by making "Preview" a locked, read-only
-- summary built from data already on the crew member's dashboard (see
-- js/reference-verification.js showVerifyLinkDialog / referencePreviewHtml)
-- instead of opening the live token URL — but the underlying token was, and
-- without this migration still would be, completable directly by anyone
-- holding it, including the crew member in their own logged-in session.
--
-- Fix: reject completion when the authenticated caller (auth.uid()) is the
-- same account that owns the token (reference_verification_tokens.user_id,
-- set to auth.uid() at request time in request_reference_verification).
-- This can't be a full guarantee — the referee never has a SEA-V account,
-- so completion has to stay callable by an anonymous/unauthenticated caller
-- by design, and a crew member determined to defeat this could still open
-- the link in a private window / different browser where they aren't
-- authenticated. What it closes is the common, low-effort case: the crew
-- member, still logged into their own SEA-V session in the same browser,
-- signing off their own reference.

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

  v_new_status := case when v_confirmed then 'Verified' else 'Declined' end;

  v_verification := jsonb_build_object(
    'confirmed', v_confirmed,
    'verifiedVia', 'email',
    'verifierEmail', token_row.sent_to_email,
    'note', v_note_text,
    'rank', coalesce(nullif(v_verifier_rank, ''), ref_row.title, ''),
    'cocNumber', v_coc_number,
    'signatureName', v_signature_name,
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
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
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
$function$;
