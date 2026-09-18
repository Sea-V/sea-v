-- =============================================================================
-- SEA-V -- Re-tighten anon's column-scoped SELECT on public.certificates.
-- =============================================================================
--
-- THE BUG (CLAUDE.md open thread 2, open since 2026-08-16, root cause older)
-- ------------------------------------------------------------------------
-- docs/schema-phase2-public-hardening.sql deliberately column-scoped anon's
-- SELECT on certificates so the attachment file could never be read by a
-- stranger -- certificate scans carry full name, DOB and nationality.
--
-- docs/schema-certificates-issuer-provider.sql:22 then issued a BLANKET
--   grant select on table public.certificates to anon;
-- which silently replaced the column-scoped grant with an all-columns one and
-- undid that hardening. Every column added since inherited public read.
--
-- Live exposure measured immediately before this migration (2026-09-18):
--   53 certificate rows belong to public_enabled profiles, of which
--   39 had a non-null `attachment` (storage path to the scan) and
--   49 had a `certificate_number` (CoC / STCW document numbers).
-- All were readable by anon via /rest/v1/certificates?select=attachment
-- with nothing but the publishable anon key.
--
-- NOT A UI CHANGE
-- ---------------
-- The public profile never rendered any of this. js/api.js's
-- PUBLIC_ARRAY_COLUMNS.certificates lists 11 columns and none of the five
-- revoked below, and js/public-profile-sections.js deliberately has no
-- CERT_FILE_BUCKET so a public certificate row never links to its file.
-- js/public-profile-utils.js's `hasStoredFile(cert.attachment)` check is
-- therefore already always false on the public profile -- the compliance pill
-- reads "Recorded", and still will. This migration closes the direct-REST
-- hole only; nothing on screen changes.
--
-- WHAT STAYS PUBLIC (the 11 columns js/api.js actually requests)
--   id, user_id, code, name, issue_date, expiry_date, status,
--   is_mandatory, is_template, created_at, updated_at
--
-- WHAT IS REVOKED
--   attachment          -- storage path to the certificate scan (PII)
--   certificate_number  -- the CoC / STCW document number
--   issuing_authority   -- not requested publicly
--   training_provider   -- not requested publicly
--   show_on_cv          -- private display preference, not public data
--
-- `authenticated` is untouched: the owner still reads all of it via select=*
-- under the per-user RLS policy, so the crew-facing Certificates page and the
-- CV generator are unaffected.
--
-- Applied to the live project 2026-09-18 via migration
-- `revoke_anon_certificates_private_columns`, and smoke-tested in the same
-- session as anon over REST: the 11 public columns return 200, each of the
-- five revoked columns returns 42501, an authenticated select=* still returns
-- every column, and get_advisors (security) reported no new findings.
--
-- Safe to re-run. Do NOT replace this with a blanket
-- `grant select on table public.certificates to anon` -- that is the exact
-- mistake this migration exists to undo.
-- =============================================================================

revoke select on table public.certificates from anon;

grant select (
  id,
  user_id,
  code,
  name,
  issue_date,
  expiry_date,
  status,
  is_mandatory,
  is_template,
  created_at,
  updated_at
) on table public.certificates to anon;
