-- =============================================================================
-- SEA-V -- Demo references back to Draft (2026-11-03, Jack: "Yes, set to Draft")
-- =============================================================================
--
-- demo-r2, demo-r3 and demo-r4 (daniel-whitfield, a demo profile) were set to
-- status 'Verified' by hand in July 2026. None went through the referee
-- flow: verification and verification_public are both NULL on all three.
-- A "Verified" badge no referee ever gave is exactly what SEA-V exists to
-- prevent, so they go back to the app's default status.
--
-- Effect: sea_references_public_read only shows 'Verified' rows to anon, so
-- these three no longer appear on daniel-whitfield's public profile.
-- demo-r1 ('Sent for Verification', with a real verification blob) is
-- untouched.
--
-- Run as postgres (Supabase MCP / SQL editor): the
-- sea_references_verification_guard trigger blocks this change for the
-- authenticated and anon roles, by design.
--
-- APPLIED 2026-11-03 via Supabase MCP. Before: anon read 3 rows
-- (demo-r2/3/4, Verified). After: anon reads 0 demo rows; owner rows intact.
--
-- RESTORE (only if ever needed):
--   update public.sea_references set status = 'Verified'
--   where id in ('demo-r2', 'demo-r3', 'demo-r4');
-- =============================================================================

update public.sea_references
set status = 'Draft'
where id in ('demo-r2', 'demo-r3', 'demo-r4')
  and status = 'Verified'
  and verification is null;
