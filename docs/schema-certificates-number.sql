-- Add an optional certificate number field to certificates.
-- Applied to the live project on 2026-08-01 via Supabase migration
-- `add_certificates_number`.
--
-- Purely additive: nullable text column, no default -- every existing
-- certificate row is untouched, nobody needs to re-enter certificates.
-- Crew can optionally fill this in via Edit on certificates already logged.
--
-- Not exposed to the public profile or CV Generator by default -- a
-- certificate/licence number is a personal credential identifier, same
-- sensitivity class as the reference CoC number that's deliberately
-- redacted from public view (see docs/schema-public-profile-age-and-coc-redaction.sql
-- or equivalent verification_public handling). Kept dashboard-only for now;
-- revisit if a legitimate reason to surface it publicly comes up.

alter table public.certificates
  add column certificate_number text;
