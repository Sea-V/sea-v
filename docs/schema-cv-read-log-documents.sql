-- =============================================================================
-- SEA-V -- the read log now covers every uploaded document (v626)
-- =============================================================================
--
-- Jack, 2026-11-06: one upload for any document, which works out what it is and where
-- it goes. Photos are allowed as well as PDF and Word, and each row records the kind
-- of document found, so cost can be read per type. It still holds nothing from the
-- document itself.
--
-- APPLIED + SMOKE-TESTED 2026-11-06 (Supabase MCP apply_migration
-- cv_read_log_documents): see the v626 entry in CLAUDE.md. Existing 2 rows unchanged, advisors 23/23.
-- =============================================================================

alter table public.cv_read_log drop constraint cv_read_log_file_kind_check;
alter table public.cv_read_log add constraint cv_read_log_file_kind_check
  check (file_kind in ('pdf', 'word', 'image'));

alter table public.cv_read_log add column doc_type text
  check (doc_type is null or doc_type in
    ('cv', 'certificate', 'testimonial', 'payslip', 'contract', 'reference', 'passport_or_id', 'other'));
