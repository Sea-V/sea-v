-- =============================================================================
-- SEA-V — Add issuing_authority / training_provider to certificates,
-- and fix a latent anon-read bug found while doing so
-- =============================================================================
-- Context: Jack asked (2026-07-26) to add "Issuing authority" and "Training
-- provider" dropdowns to the Certificates form, both with an "Other" manual
-- fallback (see js/seav-cert-issuers.js for the curated lists).
--
-- While adding these, found that certificates_public_read (an anon RLS
-- SELECT policy scoped to public profiles) had no matching base GRANT —
-- RLS policies only take effect on top of a real GRANT, so anon could never
-- actually read certificates rows regardless of the policy. Public profile
-- certificate display has likely been silently empty for anon visitors.
-- Fixed by granting table-level SELECT to anon (this table has no
-- column-level grants, unlike profile, so this one GRANT covers the new
-- columns too — nothing further needed there).
-- =============================================================================

alter table public.certificates add column if not exists issuing_authority text;
alter table public.certificates add column if not exists training_provider text;

grant select on table public.certificates to anon;
