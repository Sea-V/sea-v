-- Add file_size_limit + allowed_mime_types to all 12 storage buckets.
-- Applied to the live project on 2026-07-31 via Supabase migration
-- `add_storage_bucket_size_and_mime_limits`.
--
-- None of the 12 storage buckets had file_size_limit or allowed_mime_types
-- set, meaning upload size/type were only ever validated client-side
-- (js/core.js's MAX_UPLOAD_BYTES = 10MB check in buildStoredFile) --
-- bypassable by anyone calling the storage API directly. Setting server-
-- side limits closes that gap without changing behavior for any legitimate
-- upload: file_size_limit matches the existing 10MB client-side check
-- exactly, and allowed_mime_types matches each page's own file input
-- `accept` attribute (surveyed across every *.html upload field on
-- 2026-07-31), so nothing a real user could previously upload is now
-- rejected.
--
-- Found during the 2026-07-31 full codebase audit.

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'achievement-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/*']
where id = 'certificate-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/*']
where id = 'hobbies-interest-photos';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/*']
where id = 'onboard-experience-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/*']
where id = 'payslip-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/*']
where id = 'profile-photos';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/*']
where id = 'reference-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'seatime-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/*']
where id = 'specialist-qualification-files';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/*']
where id = 'tender-photos';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/*']
where id = 'vessel-documents';

update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/*']
where id = 'vessel-photos';
