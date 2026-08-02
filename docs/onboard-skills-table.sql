-- Onboard Skills — self-assessed skills profile (Deck/Officer + Engineering only)
--
-- Distinct from onboard_experiences: this is a fast, self-rated skills
-- snapshot (category -> skill -> 1-5 star rating), not a dated/vessel-linked/
-- signed-off logbook entry. Inspired by Yotspot's skills matrix (see
-- Sea-V/Sea-v Onboard Experience screenshots) but scoped down to just Deck
-- and Engineering per Jack's direction 2026-08-02. No file attachments, no
-- public/anon exposure yet (owner-only for now).

create table if not exists public.onboard_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('deck', 'engineering')),
  skill text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, skill)
);

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
