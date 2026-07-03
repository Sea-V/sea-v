-- Reference verification — referee attachment access + preview field
-- Run in Supabase SQL Editor (safe to re-run)
--
-- Fixes:
-- 1. Preview RPC returns attachment metadata for the reference
-- 2. Storage read for referees (security definer helper — anon cannot read token table directly)

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
    'attachment', ref_row.attachment,
    'expires_at', token_row.expires_at
  );
end;
$$;

revoke all on function public.preview_reference_verification(text) from public;
grant execute on function public.preview_reference_verification(text) to anon, authenticated;

-- Security definer: storage RLS runs as anon and cannot read token rows directly.
create or replace function public.reference_verification_allows_file_read(p_object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.reference_verification_tokens t
    join public.sea_references r on r.id = t.reference_id
    where t.used_at is null
      and t.expires_at > now()
      and coalesce(r.attachment->>'path', '') = p_object_path
  );
$$;

revoke all on function public.reference_verification_allows_file_read(text) from public;
grant execute on function public.reference_verification_allows_file_read(text) to anon, authenticated;

drop policy if exists reference_files_verification_read on storage.objects;

create policy reference_files_verification_read
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'reference-files'
    and public.reference_verification_allows_file_read(name)
  );

notify pgrst, 'reload schema';
