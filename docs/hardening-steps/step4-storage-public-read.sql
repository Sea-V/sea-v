-- Step 5d — Public profile file viewing for visitors (run in Supabase SQL Editor)
-- Test after: node scripts/test-supabase.mjs --step 4  (or --step all)

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
drop policy if exists tender_photos_public_read on storage.objects;

create policy tender_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'tender-photos'
    and exists (
      select 1
      from public.tenders t
      join public.profile p on p.user_id = t.user_id
      where p.public_enabled = true
        and t.photo->>'path' = storage.objects.name
    )
  );

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

-- Intentionally no certificate_files_public_read policy: certificate
-- attachments are never linked from the public profile, so there's nothing
-- for a public-read policy to serve. Existing certificate-files objects stay
-- readable only to their owner via certificate-files_owner_select.

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

-- NOTE: jsonb_array_elements()'s output column is named "value", not "photo"
-- -- a bare `photo->>'path'` silently resolves to the unrelated profile.photo
-- column instead of erroring, so this policy never actually matched a real
-- hobby photo. Must be photo.value->>'path'.
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
        and photo.value->>'path' = storage.objects.name
    )
  );
