-- Add UK Certificate of Equivalent Competency (CEC) and Yacht Rating
-- Certificate (STCW II/4) to the certificate dropdown catalog.
-- Applied to the live project on 2026-08-01 via migration
-- `add_cec_and_yacht_rating_cert_catalog`.
--
-- Sourced from a review of the Red Ensign Group Yacht Code (REG-YC) /
-- MCA Master's Guide to the UK Flag Large Yacht Edition:
-- - UK CEC is required for any officer without a UK Certificate of
--   Competency serving on a UK/Red-Ensign flagged yacht (MSN 1867).
-- - Yacht Rating Certificate (STCW II/4) is called out as distinct from
--   a generic Navigational/Engineering Watch Rating cert (RFPNW/RFPEW,
--   already in the catalog) -- some employers specifically require the
--   yacht-specific version.
--
-- Purely additive rows -- js/api.js's fetchCertificateCatalog() reads
-- this table live and it takes priority over the static fallback list
-- in js/seav-data.js (kept in sync here too), so no existing certificate
-- row or dropdown entry is affected.

insert into public.certificate_catalog (code, name, category, is_mandatory, sort_order, stcw_ref) values
  ('UK CEC', 'UK Certificate of Equivalent Competency (CEC)', 'CoC, rank & MCA yacht qualifications', false, 134, ''),
  ('YACHT RATING', 'Yacht Rating Certificate', 'CoC, rank & MCA yacht qualifications', false, 135, 'STCW II/4');
