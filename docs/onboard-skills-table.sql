-- Onboard Skills — self-assessed skills profile (Deck/Officer, Engineering,
-- Bridge Equipment)
--
-- Distinct from onboard_experiences: this is a fast, self-rated skills
-- snapshot (category -> skill -> 1-5 star rating), not a dated/vessel-linked/
-- signed-off logbook entry. Inspired by Yotspot's skills matrix (see
-- Sea-V/Sea-v Onboard Experience screenshots), reviewed against that source
-- and expanded 2026-08-02 to add missed Deck/Engineering items plus a new
-- Bridge Equipment category (radar, ECDIS, GPS, etc — previously just one
-- vague "Navigation and radar systems" line under Engineering). No file
-- attachments, no public/anon exposure yet (owner-only for now).

create table if not exists public.onboard_skills (
  -- text, not uuid — the id is client-generated (js/seav-data.js createId()),
  -- same convention as every other client-side entity table (onboard_experiences,
  -- hobbies_interests, specialist_qualifications, payslips). A uuid column here
  -- broke every insert with "invalid input syntax for type uuid" until fixed
  -- 2026-08-02 via the fix_onboard_skills_id_to_text migration.
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('deck', 'engineering', 'bridge')),
  skill text not null,
  rating smallint not null check (rating between 1 and 5),
  -- Short free-text note explaining the rating (e.g. what vessel/task it's
  -- based on) — added so a rating isn't just an unsupported tap on a star.
  -- Added 2026-08-02, see docs/onboard-skills-table.sql migration history.
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, skill)
);

-- 2026-08-02: added `note` column to an already-live table via a follow-up
-- migration (add_note_to_onboard_skills). Kept here so a fresh
-- create-from-scratch run of this file matches production.
--
-- 2026-08-02: widened the category check constraint to add 'bridge' via a
-- follow-up migration (add_bridge_category_to_onboard_skills).
--
-- 2026-08-02: fixed id column from uuid to text via a follow-up migration
-- (fix_onboard_skills_id_to_text) — see comment on the id column above.
--
-- 2026-08-02: exposed this table to anon (add_public_read_to_onboard_skills)
-- so the Skills self-assessment can render as a collapsible sub-section on
-- the public profile. Same dual-layer pattern as every other public entity
-- table (see docs/schema-phase2-public-hardening.sql): revoke-all then
-- column-scoped grant of the 8 safe columns to anon, plus a matching RLS
-- policy gated only on profile.public_enabled = true (no status check, since
-- this table — like vessels/navigation_areas — has no draft/publish field).

create index if not exists onboard_skills_user_id_idx on public.onboard_skills(user_id);

alter table public.onboard_skills enable row level security;

drop policy if exists "onboard_skills_owner_select" on public.onboard_skills;
create policy "onboard_skills_owner_select" on public.onboard_skills
  for select using ((select auth.uid()) = user_id);

drop policy if exists "onboard_skills_owner_insert" on public.onboard_skills;
create policy "onboard_skills_owner_insert" on public.onboard_skills
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "onboard_skills_owner_update" on public.onboard_skills;
create policy "onboard_skills_owner_update" on public.onboard_skills
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "onboard_skills_owner_delete" on public.onboard_skills;
create policy "onboard_skills_owner_delete" on public.onboard_skills
  for delete using ((select auth.uid()) = user_id);

-- Public (anon) read — added 2026-08-02, see migration-history comment above.
revoke all on public.onboard_skills from anon;
grant select (
  id, user_id, category, skill, rating, note, created_at, updated_at
) on public.onboard_skills to anon;

drop policy if exists "onboard_skills_public_read" on public.onboard_skills;
create policy "onboard_skills_public_read" on public.onboard_skills
  for select to anon using (
    exists (
      select 1 from public.profile p
      where p.user_id = onboard_skills.user_id
        and p.public_enabled = true
    )
  );
