-- =============================================================================
-- SEA-V -- engineer sea time: "in full charge of the watch" (v641)
-- =============================================================================
--
-- Jack, 2026-11-12: engineering milestones from MSN 1904 (MSN 1859 was
-- withdrawn on 10 Jan 2023). §5.4: for Chief Engineer, watchkeeping counts only
-- when the engineer was in FULL CHARGE of the engine-room watch, or on UMS
-- duties. One tick per sea time entry, shown on engineering entries only.
--
-- Private: no anon grant (the public profile shows no sea time entries).
--
-- APPLIED + SMOKE-TESTED 2026-11-12 (Supabase MCP apply_migration
-- seatimes_engine_watch_full_charge): see the v641 entry in CLAUDE.md.
-- =============================================================================

alter table public.seatimes
  add column engine_watch_full_charge boolean not null default false;
