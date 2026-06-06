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
