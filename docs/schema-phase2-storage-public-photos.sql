-- =============================================================================
-- RUN ORDER: 4 (optional)  |  SAVE AS IN SUPABASE: "4 - Public profile files"
-- =============================================================================
-- SEA-V — Let visitors on your public profile link see photos and attachments
-- Skip if schema-phase2.sql already includes section 7. See docs/SQL-SETUP-GUIDE.md
-- Prerequisite: schema-phase2.sql (step 2)
-- =============================================================================

drop policy if exists profile_photos_public_read on storage.objects;

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
