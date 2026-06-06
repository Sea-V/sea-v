-- Step 5c-fix — Drop legacy storage policies (from *-table.sql migrations)
-- Run if step 3 test still shows anon uploads succeeding.
-- Test after: node scripts/test-supabase.mjs --step 3

-- onboard-experiences-table.sql
drop policy if exists "onboard_experience_files_select" on storage.objects;
drop policy if exists "onboard_experience_files_insert" on storage.objects;
drop policy if exists "onboard_experience_files_update" on storage.objects;
drop policy if exists "onboard_experience_files_delete" on storage.objects;

-- payslips-table.sql
drop policy if exists "payslip_files_select" on storage.objects;
drop policy if exists "payslip_files_insert" on storage.objects;
drop policy if exists "payslip_files_update" on storage.objects;
drop policy if exists "payslip_files_delete" on storage.objects;

-- hobbies-interests-table.sql
drop policy if exists "hobbies_interest_photos_select" on storage.objects;
drop policy if exists "hobbies_interest_photos_insert" on storage.objects;
drop policy if exists "hobbies_interest_photos_update" on storage.objects;
drop policy if exists "hobbies_interest_photos_delete" on storage.objects;

-- specialist-qualifications-table.sql
drop policy if exists "specialist_qualification_files_select" on storage.objects;
drop policy if exists "specialist_qualification_files_insert" on storage.objects;
drop policy if exists "specialist_qualification_files_update" on storage.objects;
drop policy if exists "specialist_qualification_files_delete" on storage.objects;

-- Ensure buckets stay private
update storage.buckets set public = false where id in (
  'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
  'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
  'onboard-experience-files', 'hobbies-interest-photos',
  'specialist-qualification-files', 'payslip-files'
);
