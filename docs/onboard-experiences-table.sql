-- SEA-V: Onboard Experience table + storage bucket
-- Run in Supabase → SQL Editor (Phase 1 single-user demo)

create table if not exists public.onboard_experiences (
  id text primary key,
  vessel_id text,
  category text not null default '',
  title text not null default '',
  description text not null default '',
  location_onboard text default '',
  date_from date,
  date_to date,
  hours numeric default 0,
  is_familiarisation boolean not null default false,
  status text not null default 'Draft',
  signoff jsonb not null default '{}'::jsonb,
  attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists onboard_experiences_vessel_id_idx
  on public.onboard_experiences (vessel_id);

create index if not exists onboard_experiences_date_from_idx
  on public.onboard_experiences (date_from desc);

-- Storage bucket + Phase 1 upload policies (matches seatime-files / certificate-files)
insert into storage.buckets (id, name, public)
values ('onboard-experience-files', 'onboard-experience-files', true)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists "onboard_experience_files_select" on storage.objects;
create policy "onboard_experience_files_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'onboard-experience-files');

drop policy if exists "onboard_experience_files_insert" on storage.objects;
create policy "onboard_experience_files_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'onboard-experience-files');

drop policy if exists "onboard_experience_files_update" on storage.objects;
create policy "onboard_experience_files_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'onboard-experience-files');

drop policy if exists "onboard_experience_files_delete" on storage.objects;
create policy "onboard_experience_files_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'onboard-experience-files');

alter table public.onboard_experiences enable row level security;

-- Phase 1 demo: allow anon access (tighten in Phase 2 with auth.uid())
drop policy if exists "onboard_experiences_anon_all" on public.onboard_experiences;
create policy "onboard_experiences_anon_all"
  on public.onboard_experiences
  for all
  to anon, authenticated
  using (true)
  with check (true);
