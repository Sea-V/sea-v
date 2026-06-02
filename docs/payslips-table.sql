-- SEA-V: Payslips table + storage bucket (private records — not on public profile)
-- Run in Supabase → SQL Editor (Phase 1 single-user demo)

create table if not exists public.payslips (
  id text primary key,
  tax_year text not null default '',
  pay_period text default '',
  payment_date date,
  employer text default '',
  vessel_id text,
  gross_amount numeric,
  net_amount numeric,
  currency text not null default 'GBP',
  notes text default '',
  attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payslips_tax_year_idx
  on public.payslips (tax_year);

create index if not exists payslips_payment_date_idx
  on public.payslips (payment_date desc);

-- Storage bucket + Phase 1 upload policies
insert into storage.buckets (id, name, public)
values ('payslip-files', 'payslip-files', true)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists "payslip_files_select" on storage.objects;
create policy "payslip_files_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'payslip-files');

drop policy if exists "payslip_files_insert" on storage.objects;
create policy "payslip_files_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'payslip-files');

drop policy if exists "payslip_files_update" on storage.objects;
create policy "payslip_files_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'payslip-files');

drop policy if exists "payslip_files_delete" on storage.objects;
create policy "payslip_files_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'payslip-files');

alter table public.payslips enable row level security;

drop policy if exists "payslips_anon_all" on public.payslips;
create policy "payslips_anon_all"
  on public.payslips
  for all
  to anon, authenticated
  using (true)
  with check (true);
