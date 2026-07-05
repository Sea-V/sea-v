-- Dedupe Phase 1 vessels/tenders resurfaced after user_id backfill
-- Review output before running deletes. Keeps rows with photos + userId-prefixed paths.
-- Run in Supabase SQL Editor as Jack (ac09b28e-e429-4fe6-9d4a-516ed72ef7d8).

-- ---------------------------------------------------------------------------
-- 1. Preview duplicate vessel names (same user, similar names)
-- ---------------------------------------------------------------------------
select
  lower(trim(name)) as norm_name,
  count(*) as cnt,
  array_agg(id order by
    (photo is not null and photo->>'path' ~ '^[0-9a-f]{8}-') desc,
    created_at desc
  ) as ids,
  array_agg(name order by created_at) as names,
  array_agg(photo->>'path' order by created_at) as paths
from public.vessels
where user_id = 'ac09b28e-e429-4fe6-9d4a-516ed72ef7d8'
group by lower(trim(name))
having count(*) > 1;

-- ---------------------------------------------------------------------------
-- 2. Map legacy duplicate IDs → keeper IDs (edit if your preview differs)
-- ---------------------------------------------------------------------------
-- Example pairs from 2026-06-15 audit (delete first id, keep second):
--   f4f2dcaf-0979-415f-b43a-c14dcb5d71c2 → vessel_1779835974560_3sbxxx  (Senses)
--   vessel_1777277528566_76bhyz → vessel_1779859794907_r7zr54          (Lucky Lady)
--   vessel_1779772960365_3ply7t → vessel_1779860092035_5cw9fl          (Global / M/Y Global)
--   vessel_1779773257531_uxwypx → vessel_1779859506018_wx9l9e          (Grace / M/Y Grace)
--   vessel_1779773536197_d2kasr → vessel_1779859943552_remim4          (M/Y Northern Star)
--   vessel_1779781706734_thnoz7 → vessel_1779860292133_8dinau          (Kahalani empty dup)

create temp table vessel_dedupe_map (
  old_id text primary key,
  keep_id text not null
) on commit drop;

-- Uncomment and adjust after running preview:
-- insert into vessel_dedupe_map (old_id, keep_id) values
--   ('f4f2dcaf-0979-415f-b43a-c14dcb5d71c2', 'vessel_1779835974560_3sbxxx'),
--   ('vessel_1777277528566_76bhyz', 'vessel_1779859794907_r7zr54'),
--   ('vessel_1779772960365_3ply7t', 'vessel_1779860092035_5cw9fl'),
--   ('vessel_1779773257531_uxwypx', 'vessel_1779859506018_wx9l9e'),
--   ('vessel_1779773536197_d2kasr', 'vessel_1779859943552_remim4'),
--   ('vessel_1779781706734_thnoz7', 'vessel_1779860292133_8dinau');

-- ---------------------------------------------------------------------------
-- 3. Re-point foreign keys before delete
-- ---------------------------------------------------------------------------
-- update public.seatimes s set vessel_id = m.keep_id
-- from vessel_dedupe_map m where s.vessel_id = m.old_id;
-- update public.navigation_areas n set vessel_id = m.keep_id
-- from vessel_dedupe_map m where n.vessel_id = m.old_id;
-- update public.tenders t set vessel_id = m.keep_id
-- from vessel_dedupe_map m where t.vessel_id = m.old_id;
-- update public.achievements a set vessel_id = m.keep_id
-- from vessel_dedupe_map m where a.vessel_id = m.old_id;
-- update public.onboard_experiences o set vessel_id = m.keep_id
-- from vessel_dedupe_map m where o.vessel_id = m.old_id;
-- update public.sea_references r set vessel_id = m.keep_id
-- from vessel_dedupe_map m where r.vessel_id = m.old_id;
-- update public.payslips p set vessel_id = m.keep_id
-- from vessel_dedupe_map m where p.vessel_id = m.old_id;

-- ---------------------------------------------------------------------------
-- 4. Delete duplicate vessel rows
-- ---------------------------------------------------------------------------
-- delete from public.vessels v
-- using vessel_dedupe_map m
-- where v.id = m.old_id;

-- ---------------------------------------------------------------------------
-- 5. Tender duplicates (same name on same vessel)
-- ---------------------------------------------------------------------------
select
  lower(trim(name)) as norm_name,
  vessel_id,
  count(*) as cnt,
  array_agg(id order by
    (photo is not null and photo->>'path' ~ '^[0-9a-f]{8}-') desc,
    created_at desc
  ) as ids
from public.tenders
where user_id = 'ac09b28e-e429-4fe6-9d4a-516ed72ef7d8'
group by lower(trim(name)), vessel_id
having count(*) > 1;
