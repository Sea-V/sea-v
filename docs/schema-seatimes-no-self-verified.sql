-- =============================================================================
-- SEA-V -- crew can no longer mark their own sea time "Verified" (v639)
-- =============================================================================
--
-- Jack, 2026-11-12: "No, remove it." The Sea Time form's "Verification status"
-- let crew set Verified on their own entry, on a site built on checked records.
-- Nothing in SEA-V verifies an entry that way: the captain's confirmation lives
-- in testimonial_status (guarded by trigger, v580), and the PYA / Nautilus
-- check happens outside SEA-V.
--
-- - The 13 self-set "Verified" rows become "Logged". Restore, if ever needed:
--     update public.seatimes set verification_status = 'Verified' where id in (
--       'demo-st1','demo-st2','demo-st3','demo-st4','demo-st5',
--       'seatime_1780462038365_mz2sv8','seatime_1780462139466_d7j8br',
--       'seatime_1780462270870_5tiilg','seatime_1780462373216_a9k2t7',
--       'seatime_1780462495104_ud2ab3','seatime_1780462639779_n91wjn',
--       'seatime_1787986905667_x140na','seatime_1790122087370_tbh5h3');
--   (drop the check constraint first).
-- - A check constraint allows only 'Logged' and 'Pending Verification' (shown
--   to crew as "Sent to the PYA or Nautilus").
--
-- APPLIED + SMOKE-TESTED 2026-11-12 (Supabase MCP apply_migration
-- seatimes_no_self_verified): see the v639 entry in CLAUDE.md.
-- =============================================================================

update public.seatimes set verification_status = 'Logged'
  where verification_status = 'Verified';

update public.seatimes set verification_status = 'Logged'
  where verification_status is null
     or verification_status not in ('Logged', 'Pending Verification');

alter table public.seatimes
  add constraint seatimes_verification_status_check
  check (verification_status in ('Logged', 'Pending Verification'));
