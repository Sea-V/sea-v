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

grant select, insert, update, delete on table public.profile to authenticated;
grant select, insert, update, delete on table public.vessels to authenticated;
grant select, insert, update, delete on table public.seatimes to authenticated;
grant select, insert, update, delete on table public.certificates to authenticated;
grant select, insert, update, delete on table public.sea_references to authenticated;
grant select, insert, update, delete on table public.tenders to authenticated;
grant select, insert, update, delete on table public.achievements to authenticated;
grant select, insert, update, delete on table public.navigation_areas to authenticated;
grant select, insert, update, delete on table public.onboard_experiences to authenticated;
grant select, insert, update, delete on table public.hobbies_interests to authenticated;
grant select, insert, update, delete on table public.specialist_qualifications to authenticated;
grant select, insert, update, delete on table public.payslips to authenticated;

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

revoke all on table public.vessels from anon;
revoke all on table public.seatimes from anon;
revoke all on table public.certificates from anon;
revoke all on table public.sea_references from anon;
revoke all on table public.tenders from anon;
revoke all on table public.achievements from anon;
revoke all on table public.navigation_areas from anon;
revoke all on table public.onboard_experiences from anon;
revoke all on table public.hobbies_interests from anon;
revoke all on table public.specialist_qualifications from anon;
revoke all on table public.payslips from anon;

grant select (
  id, user_id, name, flag, gt, vessel_length, builder, vessel_role,
  vessel_type, program, experience_onboard, date_from, date_to, photo,
  created_at, updated_at
) on table public.vessels to anon;

grant select (
  id, user_id, vessel_id, flag, gt, capacity_served, date_joined, date_left,
  actual_sea_service_days, standby_service_days, yard_service_days,
  watchkeeping_days, verification_status, created_at, updated_at
) on table public.seatimes to anon;

grant select (
  id, user_id, code, name, expiry_date, status, attachment, is_mandatory,
  is_template, created_at, updated_at
) on table public.certificates to anon;

grant select (
  id, user_id, name, title, vessel_id, role, period, reference_text,
  reference_date, status, attachment, verification, created_at, updated_at
) on table public.sea_references to anon;

grant select (
  id, user_id, code, title, category, dashboard_section, badge_key,
  badge_file_name, badge_tier, badge_label, badge_image, badge_locked_image,
  vessel_id, vessel, achievement_date, status, witness_name, witness_position,
  description, attachment, auto_awarded, created_at, updated_at
) on table public.achievements to anon;

grant select (
  id, user_id, country, port, from_country, from_port, from_lat, from_lng,
  to_country, to_port, to_lat, to_lng, vessel_id, operation_type,
  passage_name, visited_date, departure_date, arrival_date, lat, lng,
  waypoints, note, created_at, updated_at
) on table public.navigation_areas to anon;

grant select (
  id, user_id, vessel_id, category, title, description, location_onboard,
  date_from, date_to, hours, is_familiarisation, status, signoff, attachment,
  created_at, updated_at
) on table public.onboard_experiences to anon;

grant select (
  id, user_id, category, title, description, date_from, date_to, status,
  photos, created_at, updated_at
) on table public.hobbies_interests to anon;

grant select (
  id, user_id, category, title, issuing_body, date_obtained, expiry, status,
  notes, attachment, created_at, updated_at
) on table public.specialist_qualifications to anon;

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
    status = 'Verified'
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

-- Drop legacy storage policies from standalone *-table.sql migrations (underscore names)
drop policy if exists "onboard_experience_files_select" on storage.objects;
drop policy if exists "onboard_experience_files_insert" on storage.objects;
drop policy if exists "onboard_experience_files_update" on storage.objects;
drop policy if exists "onboard_experience_files_delete" on storage.objects;
drop policy if exists "payslip_files_select" on storage.objects;
drop policy if exists "payslip_files_insert" on storage.objects;
drop policy if exists "payslip_files_update" on storage.objects;
drop policy if exists "payslip_files_delete" on storage.objects;
drop policy if exists "hobbies_interest_photos_select" on storage.objects;
drop policy if exists "hobbies_interest_photos_insert" on storage.objects;
drop policy if exists "hobbies_interest_photos_update" on storage.objects;
drop policy if exists "hobbies_interest_photos_delete" on storage.objects;
drop policy if exists "specialist_qualification_files_select" on storage.objects;
drop policy if exists "specialist_qualification_files_insert" on storage.objects;
drop policy if exists "specialist_qualification_files_update" on storage.objects;
drop policy if exists "specialist_qualification_files_delete" on storage.objects;

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
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_select');
    execute format(
      'create policy %I on storage.objects for select to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_select', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated
       with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_insert', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_update');
    execute format(
      'create policy %I on storage.objects for update to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_update', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_delete', bucket
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Public profile files — anon read only for files attached to public rows
-- ---------------------------------------------------------------------------

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
    execute format('drop policy if exists %I on storage.objects', bucket || '_public_read');
  end loop;
end $$;

drop policy if exists profile_photos_public_read on storage.objects;
drop policy if exists vessel_photos_public_read on storage.objects;
drop policy if exists certificate_files_public_read on storage.objects;
drop policy if exists achievement_files_public_read on storage.objects;
drop policy if exists onboard_experience_files_public_read on storage.objects;
drop policy if exists hobbies_interest_photos_public_read on storage.objects;

create policy profile_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.profile p
      where p.public_enabled = true
        and p.user_id::text = (storage.foldername(storage.objects.name))[1]
        and p.photo->>'path' = storage.objects.name
    )
  );

create policy vessel_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'vessel-photos'
    and exists (
      select 1
      from public.vessels v
      join public.profile p on p.user_id = v.user_id
      where p.public_enabled = true
        and v.photo->>'path' = storage.objects.name
    )
  );

create policy certificate_files_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'certificate-files'
    and exists (
      select 1
      from public.certificates c
      join public.profile p on p.user_id = c.user_id
      where p.public_enabled = true
        and c.attachment->>'path' = storage.objects.name
    )
  );

create policy achievement_files_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'achievement-files'
    and exists (
      select 1
      from public.achievements a
      join public.profile p on p.user_id = a.user_id
      where p.public_enabled = true
        and a.status = 'Verified'
        and a.attachment->>'path' = storage.objects.name
    )
  );

create policy onboard_experience_files_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'onboard-experience-files'
    and exists (
      select 1
      from public.onboard_experiences oe
      join public.profile p on p.user_id = oe.user_id
      where p.public_enabled = true
        and oe.status = 'Signed Off'
        and oe.attachment->>'path' = storage.objects.name
    )
  );

create policy hobbies_interest_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'hobbies-interest-photos'
    and exists (
      select 1
      from public.hobbies_interests h
      join public.profile p on p.user_id = h.user_id
      cross join lateral jsonb_array_elements(coalesce(h.photos, '[]'::jsonb)) photo
      where p.public_enabled = true
        and h.status = 'Published'
        and photo->>'path' = storage.objects.name
    )
  );
