-- Step 5c — Private storage + owner-only paths (run in Supabase SQL Editor)
-- Then run step3b-drop-legacy-storage-policies.sql if anon uploads still succeed.
-- Test after: node scripts/test-supabase.mjs --step 3

-- Legacy policies from *-table.sql (underscore names, not bucket-hyphen names)
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
