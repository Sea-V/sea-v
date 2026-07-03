-- =============================================================================
-- FIX: broken complete_reference_verification on live Supabase
-- Run this ENTIRE file in Supabase → SQL Editor → Run
-- Then: Settings → API → Reload schema (or wait ~1 min)
-- =============================================================================

create or replace function public.complete_reference_verification_v2(p_request jsonb)
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
$$;

revoke all on function public.complete_reference_verification_v2(jsonb) from public;
grant execute on function public.complete_reference_verification_v2(jsonb) to anon, authenticated;

-- Ask PostgREST to reload (Supabase)
notify pgrst, 'reload schema';

-- Quick check: should return one row named complete_reference_verification_v2
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname like 'complete_reference_verification%'
order by proname;
