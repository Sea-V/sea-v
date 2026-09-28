-- SEA-V: unlink, don't orphan, when a vessel or sea time record is deleted
-- (v538; audit thread 9, "vessel delete orphans linked rows").
--
-- Five links already had ON DELETE SET NULL foreign keys (seatimes,
-- tenders, sea_references, achievements, navigation_areas -> vessels).
-- Three had no foreign key at all, so deleting the parent left the child
-- pointing at an id that no longer exists:
--   onboard_experiences.vessel_id -> vessels.id
--   payslips.vessel_id            -> vessels.id
--   navigation_areas.seatime_id   -> seatimes.id
-- This gives them the same rule as the other five: the record is kept and
-- its link is cleared. Nothing is deleted.
--
-- One existing row was already dangling and is cleared first, or the
-- constraint cannot be added. Restore (not expected to be needed -- the
-- vessel it named no longer exists):
--   update public.payslips
--      set vessel_id = 'f4f2dcaf-0979-415f-b43a-c14dcb5d71c2'
--    where id = 'payslip_1779693225561_7le0sr';
-- (user ac09b28e..., dangling since at least 2026-05-25.)
--
-- STATUS: see the note at the foot of this file.

update public.payslips p
   set vessel_id = null
 where p.vessel_id is not null
   and not exists (select 1 from public.vessels v where v.id = p.vessel_id);

update public.onboard_experiences o
   set vessel_id = null
 where o.vessel_id is not null
   and not exists (select 1 from public.vessels v where v.id = o.vessel_id);

update public.navigation_areas n
   set seatime_id = null
 where n.seatime_id is not null
   and not exists (select 1 from public.seatimes s where s.id = n.seatime_id);

alter table public.onboard_experiences
  drop constraint if exists onboard_experiences_vessel_id_fkey;
alter table public.onboard_experiences
  add constraint onboard_experiences_vessel_id_fkey
  foreign key (vessel_id) references public.vessels (id) on delete set null;

alter table public.payslips
  drop constraint if exists payslips_vessel_id_fkey;
alter table public.payslips
  add constraint payslips_vessel_id_fkey
  foreign key (vessel_id) references public.vessels (id) on delete set null;

alter table public.navigation_areas
  drop constraint if exists navigation_areas_seatime_id_fkey;
alter table public.navigation_areas
  add constraint navigation_areas_seatime_id_fkey
  foreign key (seatime_id) references public.seatimes (id) on delete set null;

-- Foreign keys do not get an index automatically; the delete-time lookup
-- needs one. (onboard_experiences_vessel_id_idx already exists.)
create index if not exists payslips_vessel_id_idx on public.payslips (vessel_id);
create index if not exists navigation_areas_seatime_id_idx on public.navigation_areas (seatime_id);

-- APPLIED 2026-09-28 as migration `vessel_seatime_link_fks`, and
-- smoke-tested the same session as the real `authenticated` owner (JWT
-- claims set, every probe rolled back):
--   * 1 dangling payslips.vessel_id cleared (the one named above); no
--     dangling onboard_experiences.vessel_id or navigation_areas.seatime_id;
--   * deleting a vessel: payslips 45 -> 45 rows, the 6 linked to it
--     unlinked; its onboard entry unlinked (1 -> 0), not deleted;
--   * deleting a sea time record: its linked passage unlinked (1 -> 0);
--   * pointing a payslip at a vessel that does not exist is now refused;
--   * security advisors: 23 findings before and after, none new;
--   * scripts/test-supabase.mjs testOwnerWriteGuards gained the same
--     keep-and-unlink probe (runs only with SEAV_TEST_EMAIL/PASSWORD set).
