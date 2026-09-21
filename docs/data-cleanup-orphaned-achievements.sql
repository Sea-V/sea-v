-- =============================================================================
-- SEA-V -- Delete the orphaned `achievements` rows left by the badge-catalog
--          pruning. DATA cleanup, not a schema change.
-- =============================================================================
--
-- BACKGROUND
-- ----------
-- The badge catalog was pruned (30 -> 13, since regrown to 26 in
-- js/seav-badges.js). Rows earned under the retired keys stayed in the table.
-- They were inert: the app only ever reads the current keys, so none of them
-- rendered anywhere in the UI. Flagged in SEA-V-Known-Gaps-Tracker on
-- 2026-08-05 as "delete, archive, or leave as historical record?" and left
-- unanswered until Jack chose DELETE on 2026-09-20.
--
-- WHAT WENT
--   53 rows | 25 distinct stale badge_keys | 5 users | created 2026-05-11..08-04
--   None had an attachment, witness_name or witness_email, so nothing was
--   orphaned in storage and no referee PII was involved.
--
-- Stale keys: bridge_leader, command_experience, commercial_vessel,
--   explorer_vessel, first_promotion, first_vessel_logged, first_watchkeeping,
--   helicopter_ops, large_yacht_50m, officer_rank, offshore_100nm, oow_level,
--   passage_1000nm, passage_500nm, polar_navigation, sea_100_days,
--   sea_1_year, sea_250_days, sea_30_days, sea_3_years, sea_500_days,
--   tender_ops, vessels_3_served, watchkeeping_100_days, watersports_ops
--
-- AFTER
--   95 rows -> 42. All 42 live rows untouched. Users holding at least one
--   achievement row went 8 -> 5: three users' rows were ALL orphaned, so they
--   now have none. Nothing changes on their screen -- those badges were
--   already invisible, which is the whole reason the rows were inert.
--
-- RESTORE
--   ~/Desktop/sea-v-orphaned-achievements-restore-2026-09-20.sql
--   Deliberately NOT in this repo: it holds five real users' records, and
--   committing it would write other people's data into git history for good.
--   It reinserts every row with its original id and timestamps. Delete that
--   file once the deletion is settled.
--
-- Applied 2026-09-20 as migration
-- `delete_orphaned_achievements_from_badge_catalog_pruning`, verified in the
-- same session (0 orphans left, 42 live rows, no NULL badge_key), and
-- get_advisors reported no new findings.
--
-- The applied statement was GUARDED -- it aborted unless it matched exactly the
-- 53 rows the restore file was built from, so a catalog change between snapshot
-- and run could not widen the blast radius. That guard is reproduced below.
-- Re-running now is a no-op: it will abort, because 0 rows match.
-- =============================================================================

do $$
declare
  n integer;
begin
  create temp table _orphans on commit drop as
  select id from public.achievements
   where badge_key not in (
     'antarctic_circle_crossing','arctic_circle_crossing','atlantic_crossing',
     'cape_horn_rounding','chief_mate_3000gt_eligible','chief_mate_yachts_unlimited',
     'corinth_canal_transit','date_line_crossing','drake_passage_crossing',
     'equator_crossing','good_hope_rounding','indian_ocean_crossing',
     'magellan_transit','master_200gt_sea_service','master_3000gt_sea_service',
     'master_500gt_sea_service','master_yachts_unlimited','northwest_passage_transit',
     'oow_250_actual_days','oow_3000gt_sea_time','oow_365_qualifying_days',
     'oow_36_months_onboard','pacific_crossing','panama_canal_transit',
     'suez_canal_transit','yachtmaster_offshore'
   );

  select count(*) into n from _orphans;

  if n <> 53 then
    raise exception
      'Aborted: expected exactly 53 orphaned achievements, found %. The restore file was built against 53 rows.', n;
  end if;

  delete from public.achievements a using _orphans o where a.id = o.id;
end $$;
