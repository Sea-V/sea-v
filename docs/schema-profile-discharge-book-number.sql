-- /docs/schema-profile-discharge-book-number.sql
-- Adds Seamen's Discharge Book Number to the profile table.
-- Applied live 2026-08-05 via Supabase MCP — this file documents that change,
-- matching the repo's convention of one file per schema change.
--
-- Privacy: intentionally private-only, same treatment as dob/email/phone/
-- salary. Postgres column grants are an explicit allowlist (see
-- SEA-V-Data-Model-and-RLS-Reference.xlsx), so simply not granting SELECT to
-- anon on this column is sufficient — no separate RLS policy change needed.
-- Confirmed live: anon has zero privileges on this column post-migration.

alter table public.profile
  add column if not exists discharge_book_number text;

comment on column public.profile.discharge_book_number is
  'Seamen''s Discharge Book number. Private only — never granted to anon, never returned by get_public_profile().';
