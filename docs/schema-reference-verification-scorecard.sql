-- Reference verification — referee performance scorecard
-- Run in Supabase SQL Editor after schema-reference-verification-referee-authored-text.sql
-- Safe to re-run
--
-- STATUS (2026-08-07): this migration IS applied live, and v4 IS the RPC
-- verify-reference.html currently calls — but the star-rating UI itself was
-- shelved the same day, before shipping, over a real conflict-of-interest
-- concern: a referee rating that the crew member themselves can see pushes
-- toward inflated scores or referees declining to respond at all, which
-- hurts the crew member more than it helps. Doing this properly needs an
-- employer/vessel account type (doesn't exist yet) and a real answer on
-- UK GDPR subject-access exposure for confidential references (needs a
-- solicitor, not assumptions). So: no UI currently sends `scorecard` or
-- `wouldRehire` — v4 behaves identically to v3 in practice. Keep this
-- migration as-is (safe, inert groundwork); don't re-add the UI without
-- Jack's explicit direction on visibility.
--
-- Adds an optional star-rating scorecard (10 categories, 1-5 each) and a
-- would-rehire yes/no toggle to the referee verification form
-- (verify-reference.html). Both are stored inside the existing
-- sea_references.verification jsonb column — no new columns needed:
--   verification.scorecard   -> { character: 4, reliability: 5, ... }
--   verification.wouldRehire -> true | false | null
--
-- Both fields are OPTIONAL — a referee can still confirm a reference with
-- no scorecard filled in (older links / referees who skip it), so this
-- does not add a new hard requirement on top of signature + reference text.
--
-- Per the codebase's RPC-versioning convention (see
-- schema-reference-verification-revoke-legacy-rpc-versions.sql), this ships
-- as a new complete_reference_verification_v4 rather than editing v3 in
-- place, then revokes v3 so the client can't silently fall back to a
-- version that drops the scorecard.

create or replace function public.complete_reference_verification_v4(p_request jsonb)
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
  v_scorecard jsonb := null;
  v_would_rehire jsonb := null;
  v_score_key text;
  v_score_val jsonb;
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

  -- Scorecard is optional, but if present every value must be a whole
  -- number 1-5 — a referee's browser is the only thing building this
  -- object, so validate rather than trust it blindly.
  if p_payload ? 'scorecard' and jsonb_typeof(p_payload->'scorecard') = 'object' then
    for v_score_key, v_score_val in select * from jsonb_each(p_payload->'scorecard') loop
      if jsonb_typeof(v_score_val) <> 'number'
        or (v_score_val)::numeric < 1
        or (v_score_val)::numeric > 5
        or (v_score_val)::numeric <> floor((v_score_val)::numeric) then
        raise exception 'Invalid scorecard rating for %', v_score_key;
      end if;
    end loop;
    v_scorecard := p_payload->'scorecard';
  end if;

  if p_payload ? 'wouldRehire' and p_payload->'wouldRehire' is not null then
    v_would_rehire := to_jsonb((p_payload->>'wouldRehire')::boolean);
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
    'completedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'scorecard', v_scorecard,
    'wouldRehire', v_would_rehire
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

revoke all on function public.complete_reference_verification_v4(jsonb) from public;
grant execute on function public.complete_reference_verification_v4(jsonb) to anon, authenticated;

revoke execute on function public.complete_reference_verification_v3(jsonb) from anon, authenticated;

notify pgrst, 'reload schema';
