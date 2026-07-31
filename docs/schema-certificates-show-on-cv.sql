-- Add a per-certificate "Display on CV Generator" toggle.
-- Applied to the live project on 2026-07-31 via Supabase migration
-- `add_certificates_show_on_cv`.
--
-- Defaults to true so every existing certificate keeps appearing on the
-- CV Generator the moment this ships -- nobody has to go back and
-- re-tick every certificate mid-launch. Mandatory CoC/STCW certificates
-- always show on the CV regardless of this flag (enforced client-side
-- in js/cv-engine-model.js, not at the DB level) -- the checkbox only
-- controls additional/optional certificates.
--
-- Scoped to the CV Generator only. The public profile's Certificates
-- section is untouched and continues to show every saved certificate.

alter table public.certificates
  add column show_on_cv boolean not null default true;
