-- Step 5b — Legacy path SELECT for remaining storage buckets
-- Run after step5-storage-legacy-cleanup.sql
-- Step 5 only extended legacy reads for onboard, seatime, certs, tenders, vessels, hobbies.
-- These buckets still require userId/ prefix only (step 3), blocking Phase 1 paths.

-- ---------------------------------------------------------------------------
-- 1. Owner SELECT — legacy paths referenced on user rows
--
-- IMPORTANT: qualify the path comparison as storage.objects.name, not a bare
-- `name`. vessels/sea_references/profile each have their own "name" column,
-- so a bare `name` inside the EXISTS subquery silently resolves to THAT
-- column instead of the outer storage.objects.name — the fallback clause
-- then never matches. Found + fixed live 2026-07-06 for vessel-documents,
-- reference-files, profile-photos (see step5 for the matching bug in
-- certificate-files/tender-photos/vessel-photos). Qualifying every policy
-- below (even the already-safe ones) so this can't recur if re-run fresh.
-- ---------------------------------------------------------------------------

drop policy if exists "vessel-documents_owner_select" on storage.objects;
create policy "vessel-documents_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vessel-documents'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.vessels v
        where v.user_id = auth.uid()
          and v.sea_attachment->>'path' = storage.objects.name
      )
    )
  );

drop policy if exists "reference-files_owner_select" on storage.objects;
create policy "reference-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reference-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.sea_references r
        where r.user_id = auth.uid()
          and r.attachment->>'path' = storage.objects.name
      )
    )
  );

drop policy if exists "achievement-files_owner_select" on storage.objects;
create policy "achievement-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'achievement-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.achievements a
        where a.user_id = auth.uid()
          and a.attachment->>'path' = storage.objects.name
      )
    )
  );

drop policy if exists "specialist-qualification-files_owner_select" on storage.objects;
create policy "specialist-qualification-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'specialist-qualification-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.specialist_qualifications sq
        where sq.user_id = auth.uid()
          and sq.attachment->>'path' = storage.objects.name
      )
    )
  );

drop policy if exists "payslip-files_owner_select" on storage.objects;
create policy "payslip-files_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payslip-files'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.payslips p
        where p.user_id = auth.uid()
          and p.attachment->>'path' = storage.objects.name
      )
    )
  );

drop policy if exists "profile-photos_owner_select" on storage.objects;
create policy "profile-photos_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.profile pr
        where pr.user_id = auth.uid()
          and pr.photo->>'path' = storage.objects.name
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Backfill missing bucket metadata on JSON file fields
-- ---------------------------------------------------------------------------

update public.vessels
set sea_attachment = sea_attachment || '{"bucket":"vessel-documents"}'::jsonb
where sea_attachment ? 'path' and coalesce(sea_attachment->>'bucket', '') = '';

update public.sea_references
set attachment = attachment || '{"bucket":"reference-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.achievements
set attachment = attachment || '{"bucket":"achievement-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.specialist_qualifications
set attachment = attachment || '{"bucket":"specialist-qualification-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.payslips
set attachment = attachment || '{"bucket":"payslip-files"}'::jsonb
where attachment ? 'path' and coalesce(attachment->>'bucket', '') = '';

update public.hobbies_interests
set photos = (
  select coalesce(jsonb_agg(
    case
      when photo ? 'path' and coalesce(photo->>'bucket', '') = ''
      then photo || '{"bucket":"hobbies-interest-photos"}'::jsonb
      else photo
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(photos, '[]'::jsonb)) photo
)
where photos is not null
  and exists (
    select 1
    from jsonb_array_elements(coalesce(photos, '[]'::jsonb)) photo
    where photo ? 'path' and coalesce(photo->>'bucket', '') = ''
  );
