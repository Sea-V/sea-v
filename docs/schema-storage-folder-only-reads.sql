-- Storage: folder-only reads (GDPR art. 32 security fix, v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (see bottom of file).
--
-- THE HOLE (CLAUDE.md thread 9). Two kinds of storage.objects SELECT policy
-- trusted a path written in a table row instead of the folder the file
-- actually lives in:
--
-- 1. <bucket>_owner_select (12 buckets): "the file is in MY folder, OR any
--    row of mine has attachment->>'path' = this file". A member could save
--    another member's path (e.g. <their uid>/payslip.pdf) into their own
--    row and then read the file — payslips, certificates, SEAs, references.
-- 2. *_public_read (anon, 5 buckets): "some PUBLIC profile's row points at
--    this file". A member with a public profile could point a row at a
--    private member's file and anon could then read it. profile_photos was
--    already folder-checked and is the model for the fix.
--
-- Before applying: every one of the 159 stored paths across 15 columns
-- sits in its owner's own folder (zero outside), so dropping the OR branch
-- breaks no real file. Uploads already write <uid>/... (insert policies
-- enforce it).
--
-- AFTER: owners read their own folder only; anon reads a file only when it
-- is in the folder of the public owner whose row references it.

begin;

drop policy if exists "achievement-files_owner_select" on storage.objects;
create policy "achievement-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'achievement-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "certificate-files_owner_select" on storage.objects;
create policy "certificate-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'certificate-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "hobbies-interest-photos_owner_select" on storage.objects;
create policy "hobbies-interest-photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'hobbies-interest-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "onboard-experience-files_owner_select" on storage.objects;
create policy "onboard-experience-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'onboard-experience-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "payslip-files_owner_select" on storage.objects;
create policy "payslip-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'payslip-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "profile-photos_owner_select" on storage.objects;
create policy "profile-photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "reference-files_owner_select" on storage.objects;
create policy "reference-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'reference-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "seatime-files_owner_select" on storage.objects;
create policy "seatime-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'seatime-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "specialist-qualification-files_owner_select" on storage.objects;
create policy "specialist-qualification-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'specialist-qualification-files' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "tender-photos_owner_select" on storage.objects;
create policy "tender-photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'tender-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "vessel-documents_owner_select" on storage.objects;
create policy "vessel-documents_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'vessel-documents' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "vessel-photos_owner_select" on storage.objects;
create policy "vessel-photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'vessel-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

-- Public reads: same conditions as before, plus the file must sit in the
-- folder of the profile owner whose row points at it.
drop policy if exists "achievement_files_public_read" on storage.objects;
create policy "achievement_files_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'achievement-files' and exists (
    select 1 from achievements a join profile p on p.user_id = a.user_id
    where p.public_enabled = true and a.status = 'Verified'
      and (a.attachment ->> 'path') = objects.name
      and (storage.foldername(objects.name))[1] = a.user_id::text));

drop policy if exists "hobbies_interest_photos_public_read" on storage.objects;
create policy "hobbies_interest_photos_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'hobbies-interest-photos' and exists (
    select 1 from hobbies_interests h join profile p on p.user_id = h.user_id
      cross join lateral jsonb_array_elements(coalesce(h.photos, '[]'::jsonb)) photo(value)
    where p.public_enabled = true and h.status = 'Published'
      and (photo.value ->> 'path') = objects.name
      and (storage.foldername(objects.name))[1] = h.user_id::text));

drop policy if exists "onboard_experience_files_public_read" on storage.objects;
create policy "onboard_experience_files_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'onboard-experience-files' and exists (
    select 1 from onboard_experiences oe join profile p on p.user_id = oe.user_id
    where p.public_enabled = true and oe.status = 'Signed Off'
      and (oe.attachment ->> 'path') = objects.name
      and (storage.foldername(objects.name))[1] = oe.user_id::text));

drop policy if exists "tender_photos_public_read" on storage.objects;
create policy "tender_photos_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'tender-photos' and exists (
    select 1 from tenders t join profile p on p.user_id = t.user_id
    where p.public_enabled = true
      and (t.photo ->> 'path') = objects.name
      and (storage.foldername(objects.name))[1] = t.user_id::text));

drop policy if exists "vessel_photos_public_read" on storage.objects;
create policy "vessel_photos_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'vessel-photos' and exists (
    select 1 from vessels v join profile p on p.user_id = v.user_id
    where p.public_enabled = true
      and (v.photo ->> 'path') = objects.name
      and (storage.foldername(objects.name))[1] = v.user_id::text));

commit;

-- SMOKE TEST 2026-10-08 (as the real authenticated / anon roles, rolled back):
--   member A planted member B's payslip path into A's own certificate row:
--     the row saved (1 row), the file stayed unreadable (0)   -- hole closed
--   A still reads A's own certificate file (1)                -- no breakage
--   anon: 16/16 public vessel photos, 20/20 public tender photos visible;
--     0 files visible in payslip / certificate / vessel-documents / seatime
--   test-supabase.mjs --step all: passes, incl. new testPublicStorageReads
--     (signs a real public vessel photo through /storage/v1 as anon: 200)
--   security advisors: 23 before, 23 after, none new.
