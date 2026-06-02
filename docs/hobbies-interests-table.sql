-- SEA-V: Hobbies & Interests table + storage bucket
-- Run in Supabase → SQL Editor (Phase 1 single-user demo)

create table if not exists public.hobbies_interests (
  id text primary key,
  category text not null default '',
  title text not null default '',
  description text not null default '',
  date_from date,
  date_to date,
  status text not null default 'Published',
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists hobbies_interests_date_from_idx
  on public.hobbies_interests (date_from desc);

create index if not exists hobbies_interests_status_idx
  on public.hobbies_interests (status);

-- Storage bucket + Phase 1 upload policies
insert into storage.buckets (id, name, public)
values ('hobbies-interest-photos', 'hobbies-interest-photos', true)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists "hobbies_interest_photos_select" on storage.objects;
create policy "hobbies_interest_photos_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'hobbies-interest-photos');

drop policy if exists "hobbies_interest_photos_insert" on storage.objects;
create policy "hobbies_interest_photos_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'hobbies-interest-photos');

drop policy if exists "hobbies_interest_photos_update" on storage.objects;
create policy "hobbies_interest_photos_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'hobbies-interest-photos');

drop policy if exists "hobbies_interest_photos_delete" on storage.objects;
create policy "hobbies_interest_photos_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'hobbies-interest-photos');

alter table public.hobbies_interests enable row level security;

-- Phase 1 demo: allow anon access (tighten in Phase 2 with auth.uid())
drop policy if exists "hobbies_interests_anon_all" on public.hobbies_interests;
create policy "hobbies_interests_anon_all"
  on public.hobbies_interests
  for all
  to anon, authenticated
  using (true)
  with check (true);
