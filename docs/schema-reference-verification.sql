-- =============================================================================
-- RUN ORDER: after schema-phase2.sql and schema-phase2-public-hardening.sql
-- Reference verification — email link tokens + RPC endpoints
-- Safe to re-run (create or replace functions).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Token store (service role / security definer only — no client policies)
-- ---------------------------------------------------------------------------
create table if not exists public.reference_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null references public.sea_references(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  sent_to_email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reference_verification_tokens_reference_id_idx
  on public.reference_verification_tokens (reference_id);

create index if not exists reference_verification_tokens_expires_at_idx
  on public.reference_verification_tokens (expires_at);

alter table public.reference_verification_tokens enable row level security;

-- No RLS policies: authenticated/anon clients cannot read tokens directly.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.hash_reference_verification_token(p_token text)
returns text
language sql
immutable
strict
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.reference_verification_site_url()
returns text
language plpgsql
stable
as $$
declare
  configured text;
begin
  configured := nullif(current_setting('app.settings.site_url', true), '');
  if configured is not null then
    return rtrim(configured, '/');
  end if;
  return 'https://www.sea-v.com';
end;
$$;

-- Optional: set in Supabase Dashboard → Database → Settings → custom config, or:
-- alter database postgres set app.settings.site_url = 'https://www.sea-v.com';

-- ---------------------------------------------------------------------------
-- Crew member: create token + mark reference as sent
-- Returns plain token once (for email link). Caller must be reference owner.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Public: load safe preview for referee (anon + authenticated)
-- ---------------------------------------------------------------------------
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

revoke all on function public.preview_reference_verification(text) from public;
grant execute on function public.preview_reference_verification(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: referee confirms or declines
-- ---------------------------------------------------------------------------
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
  verification jsonb;
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

  verification := jsonb_build_object(
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
    verification = verification,
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

revoke all on function public.complete_reference_verification(text, jsonb) from public;
grant execute on function public.complete_reference_verification(text, jsonb) to anon, authenticated;
