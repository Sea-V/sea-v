-- =============================================================================
-- RUN ORDER: 5  |  SAVE AS IN SUPABASE: "5 - Public profile and storage hardening"
-- =============================================================================
-- SEA-V — Tighten public-profile privacy + re-apply private storage (Phase 2)
-- Prerequisite: schema-full.sql (step 1) and schema-phase2.sql (step 2) applied.
-- Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profile — anon may only read safe columns (not email, phone, salary, etc.)
-- ---------------------------------------------------------------------------
revoke all on table public.profile from anon;

grant select on table public.profile to authenticated;

grant select (
  id,
  user_id,
  name,
  rank,
  qualification,
  nationality,
  dob,
  location,
  availability,
  bio,
  photo,
  public_enabled,
  created_at,
  updated_at
) on table public.profile to anon;

-- profile_public_read policy from step 2 still gates rows (public_enabled = true)

-- ---------------------------------------------------------------------------
-- 2. Replace broad anon table policies with status-aware rules
-- ---------------------------------------------------------------------------
drop policy if exists sea_references_public_read on public.sea_references;
create policy sea_references_public_read
  on public.sea_references for select to anon
  using (
    status = 'Verified'
    and exists (
      select 1 from public.profile p
      where p.user_id = sea_references.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read
  on public.achievements for select to anon
  using (
    status = 'Approved'
    and exists (
      select 1 from public.profile p
      where p.user_id = achievements.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists onboard_experiences_public_read on public.onboard_experiences;
create policy onboard_experiences_public_read
  on public.onboard_experiences for select to anon
  using (
    status = 'Signed Off'
    and exists (
      select 1 from public.profile p
      where p.user_id = onboard_experiences.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists hobbies_interests_public_read on public.hobbies_interests;
create policy hobbies_interests_public_read
  on public.hobbies_interests for select to anon
  using (
    status = 'Published'
    and exists (
      select 1 from public.profile p
      where p.user_id = hobbies_interests.user_id
        and p.public_enabled = true
    )
  );

-- Tenders are not shown on public profile — remove anon read
drop policy if exists tenders_public_read on public.tenders;

-- Payslips: never public
drop policy if exists payslips_public_read on public.payslips;

-- ---------------------------------------------------------------------------
-- 3. Storage — private buckets + owner-only paths (re-apply Phase 2 section 5)
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id in (
  'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
  'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
  'onboard-experience-files', 'hobbies-interest-photos',
  'specialist-qualification-files', 'payslip-files'
);

do $$
declare
  bucket text;
begin
  foreach bucket in array array[
    'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
    'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
    'onboard-experience-files', 'hobbies-interest-photos',
    'specialist-qualification-files', 'payslip-files'
  ]
  loop
    execute format('drop policy if exists %I on storage.objects', bucket || '_select');
    execute format('drop policy if exists %I on storage.objects', bucket || '_insert');
    execute format('drop policy if exists %I on storage.objects', bucket || '_update');
    execute format('drop policy if exists %I on storage.objects', bucket || '_delete');
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_select');
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_insert');
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_update');
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_delete');
  end loop;
end $$;

do $$
declare
  bucket text;
begin
  foreach bucket in array array[
    'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
    'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
    'onboard-experience-files', 'hobbies-interest-photos',
    'specialist-qualification-files', 'payslip-files'
  ]
  loop
    execute format(
      'create policy %I on storage.objects for select to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_select', bucket
    );
    execute format(
      'create policy %I on storage.objects for insert to authenticated
       with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_insert', bucket
    );
    execute format(
      'create policy %I on storage.objects for update to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_update', bucket
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_delete', bucket
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Public profile files — anon read when profile is public (not payslips)
-- ---------------------------------------------------------------------------
do $$
declare
  bucket text;
begin
  foreach bucket in array array[
    'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
    'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
    'onboard-experience-files', 'hobbies-interest-photos',
    'specialist-qualification-files'
  ]
  loop
    execute format('drop policy if exists %I on storage.objects', bucket || '_public_read');
    execute format(
      'create policy %I on storage.objects for select to anon
       using (
         bucket_id = %L
         and exists (
           select 1
           from public.profile p
           where p.public_enabled = true
             and p.user_id::text = (storage.foldername(name))[1]
         )
       )',
      bucket || '_public_read',
      bucket
    );
  end loop;
end $$;
