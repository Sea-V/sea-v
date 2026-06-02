-- SEA-V: Specialist Qualifications table + storage bucket
-- Run in Supabase → SQL Editor (Phase 1 single-user demo)

create table if not exists public.specialist_qualifications (
  id text primary key,
  category text not null default '',
  title text not null default '',
  issuing_body text default '',
  date_obtained date,
  expiry date,
  status text not null default 'Self-declared',
  notes text default '',
  attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists specialist_qualifications_category_idx
  on public.specialist_qualifications (category);

create index if not exists specialist_qualifications_date_obtained_idx
  on public.specialist_qualifications (date_obtained desc);

-- Storage bucket + Phase 1 upload policies
insert into storage.buckets (id, name, public)
values ('specialist-qualification-files', 'specialist-qualification-files', true)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists "specialist_qualification_files_select" on storage.objects;
create policy "specialist_qualification_files_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'specialist-qualification-files');

drop policy if exists "specialist_qualification_files_insert" on storage.objects;
create policy "specialist_qualification_files_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'specialist-qualification-files');

drop policy if exists "specialist_qualification_files_update" on storage.objects;
create policy "specialist_qualification_files_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'specialist-qualification-files');

drop policy if exists "specialist_qualification_files_delete" on storage.objects;
create policy "specialist_qualification_files_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'specialist-qualification-files');

alter table public.specialist_qualifications enable row level security;

drop policy if exists "specialist_qualifications_anon_all" on public.specialist_qualifications;
create policy "specialist_qualifications_anon_all"
  on public.specialist_qualifications
  for all
  to anon, authenticated
  using (true)
  with check (true);
