-- Step 5 — Drop Phase 1 anon storage policies + legacy path read access + data backfills
-- Run in Supabase SQL Editor after steps 1–4.
-- Fixes: old uploads stored as entityId/filename (no user UUID prefix) become unreadable
-- after step 3 owner policies; hobby public photo policy typo in some deployments.

-- ---------------------------------------------------------------------------
-- 1. Drop legacy wide-open anon storage policies (Phase 1 demo)
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public deletes from certificate files" on storage.objects;
drop policy if exists "Allow public deletes from vessel photos" on storage.objects;
drop policy if exists "Allow public profile photo reads" on storage.objects;
drop policy if exists "Allow public profile photo updates" on storage.objects;
drop policy if exists "Allow public profile photo uploads" on storage.objects;
drop policy if exists "Allow public reads from certificate files" on storage.objects;
drop policy if exists "Allow public reads from vessel photos" on storage.objects;
drop policy if exists "Allow public reference file deletes" on storage.objects;
drop policy if exists "Allow public reference file reads" on storage.objects;
drop policy if exists "Allow public reference file updates" on storage.objects;
drop policy if exists "Allow public reference file uploads" on storage.objects;
drop policy if exists "Allow public seatime file deletes" on storage.objects;
drop policy if exists "Allow public seatime file reads" on storage.objects;
drop policy if exists "Allow public seatime file updates" on storage.objects;
drop policy if exists "Allow public seatime file uploads" on storage.objects;
drop policy if exists "Allow public tender photo deletes" on storage.objects;
drop policy if exists "Allow public tender photo reads" on storage.objects;
drop policy if exists "Allow public tender photo updates" on storage.objects;
drop policy if exists "Allow public tender photo uploads" on storage.objects;
drop policy if exists "Allow public updates to certificate files" on storage.objects;
drop policy if exists "Allow public updates to vessel photos" on storage.objects;
drop policy if exists "Allow public uploads to certificate files" on storage.objects;
drop policy if exists "Allow public uploads to vessel photos" on storage.objects;

-- Also run step3b if not done yet (table.sql migration policy names)
-- docs/hardening-steps/step3b-drop-legacy-storage-policies.sql

-- ---------------------------------------------------------------------------
-- 2. Fix hobbies public read policy (must match photo path, not profile photo)
-- ---------------------------------------------------------------------------
drop policy if exists hobbies_interest_photos_public_read on storage.objects;
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

-- ---------------------------------------------------------------------------
-- 3. Owner SELECT — allow paths referenced on the user's rows (legacy uploads)
-- ---------------------------------------------------------------------------
drop policy if exists "onboard-experience-files_owner_select" on storage.objects;
create policy "onboard-experience-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'onboard-experience-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.onboard_experiences oe
        where oe.user_id = auth.uid()
          and oe.attachment->>'path' = name
      )
    )
  );

drop policy if exists "seatime-files_owner_select" on storage.objects;
create policy "seatime-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'seatime-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.seatimes s
        where s.user_id = auth.uid()
          and s.attachment->>'path' = name
      )
    )
  );

drop policy if exists "certificate-files_owner_select" on storage.objects;
create policy "certificate-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'certificate-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.certificates c
        where c.user_id = auth.uid()
          and c.attachment->>'path' = name
      )
    )
  );

drop policy if exists "tender-photos_owner_select" on storage.objects;
create policy "tender-photos_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tender-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.tenders t
        where t.user_id = auth.uid()
          and t.photo->>'path' = name
      )
    )
  );

drop policy if exists "vessel-photos_owner_select" on storage.objects;
create policy "vessel-photos_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vessel-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.vessels v
        where v.user_id = auth.uid()
          and v.photo->>'path' = name
      )
    )
  );

drop policy if exists "hobbies-interest-photos_owner_select" on storage.objects;
create policy "hobbies-interest-photos_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'hobbies-interest-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1
        from public.hobbies_interests h
        cross join lateral jsonb_array_elements(coalesce(h.photos, '[]'::jsonb)) photo
        where h.user_id = auth.uid()
          and photo->>'path' = name
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Backfill attachment.bucket where path exists but bucket is missing
-- ---------------------------------------------------------------------------
update public.onboard_experiences
set attachment = attachment || '{"bucket":"onboard-experience-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.seatimes
set attachment = attachment || '{"bucket":"seatime-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.certificates
set attachment = attachment || '{"bucket":"certificate-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

-- ---------------------------------------------------------------------------
-- 5. Assign orphaned Phase 1 rows to primary account (applied 2026-06-15)
-- Run docs/schema-migrate-default-profile.sql per additional user if needed.
-- ---------------------------------------------------------------------------
