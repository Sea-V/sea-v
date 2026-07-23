-- =============================================================================
-- RUN ORDER: 1  |  SAVE AS IN SUPABASE: "1 - Create all tables"
-- =============================================================================
-- SEA-V — Full database setup (tables + storage buckets + demo access rules)
-- Run once on a NEW Supabase project. See docs/SQL-SETUP-GUIDE.md for plain English.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profile (single demo row: id = default-profile)
-- ---------------------------------------------------------------------------
create table if not exists public.profile (
  id text primary key,
  name text default '',
  rank text default '',
  qualification text default '',
  nationality text default '',
  dob date,
  location text default '',
  email text default '',
  phone text default '',
  passports_held text default '',
  visas_held text default '',
  salary text default '',
  availability text default '',
  bio text default '',
  photo jsonb,
  public_enabled boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.profile (id, name, public_enabled, updated_at)
values ('default-profile', '', false, now())
on conflict (id) do update set updated_at = excluded.updated_at;

-- ---------------------------------------------------------------------------
-- Core entity tables
-- ---------------------------------------------------------------------------
create table if not exists public.vessels (
  id text primary key,
  name text default '',
  flag text default '',
  gt text default '',
  vessel_length text default '',
  builder text default '',
  vessel_role text default '',
  vessel_type text default '',
  program text default '',
  experience_onboard text default '',
  date_from date,
  date_to date,
  photo jsonb,
  sea_attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seatimes (
  id text primary key,
  vessel_id text,
  flag text default '',
  gt text default '',
  imo_official_number text default '',
  capacity_served text default '',
  date_joined date,
  date_left date,
  actual_sea_service_days numeric default 0,
  standby_service_days numeric default 0,
  yard_service_days numeric default 0,
  watchkeeping_days numeric default 0,
  verification_status text default 'Logged',
  notes text default '',
  attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.certificates (
  id text primary key,
  code text default '',
  name text default '',
  issue_date text,
  expiry_date text,
  status text default '',
  attachment jsonb,
  is_mandatory boolean default false,
  is_template boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sea_references (
  id text primary key,
  name text default '',
  title text default '',
  email text default '',
  vessel_id text,
  role text default '',
  period text default '',
  reference_text text default '',
  reference_date date,
  status text default 'Draft',
  attachment jsonb,
  verification jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tenders (
  id text primary key,
  name text default '',
  vessel_id text,
  type text default '',
  model text default '',
  length text default '',
  engine text default '',
  capacity text default '',
  reg text default '',
  proficiency_level text default '',
  description text default '',
  photo jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.achievements (
  id text primary key,
  code text default '',
  title text default '',
  category text default '',
  dashboard_section text default '',
  badge_key text default '',
  badge_file_name text default '',
  badge_tier text default '',
  badge_label text default '',
  badge_image text default '',
  badge_locked_image text default '',
  vessel_id text,
  vessel text default '',
  achievement_date date,
  status text default 'Draft',
  witness_name text default '',
  witness_position text default '',
  witness_email text default '',
  witness_coc_number text default '',
  description text default '',
  attachment jsonb,
  auto_awarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.navigation_areas (
  id text primary key,
  country text default '',
  port text default '',
  from_country text default '',
  from_port text default '',
  from_lat numeric default 0,
  from_lng numeric default 0,
  to_country text default '',
  to_port text default '',
  to_lat numeric default 0,
  to_lng numeric default 0,
  vessel_id text,
  seatime_id text,
  operation_type text default '',
  passage_name text default '',
  visited_date date,
  departure_date date,
  arrival_date date,
  lat numeric default 0,
  lng numeric default 0,
  waypoints jsonb default '[]'::jsonb,
  note text default '',
  is_tidal boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- ---------------------------------------------------------------------------
-- Row Level Security (Phase 1 demo — tighten before multi-user)
-- ---------------------------------------------------------------------------
alter table public.profile enable row level security;
alter table public.vessels enable row level security;
alter table public.seatimes enable row level security;
alter table public.certificates enable row level security;
alter table public.sea_references enable row level security;
alter table public.tenders enable row level security;
alter table public.achievements enable row level security;
alter table public.navigation_areas enable row level security;
alter table public.onboard_experiences enable row level security;
alter table public.hobbies_interests enable row level security;
alter table public.specialist_qualifications enable row level security;
alter table public.payslips enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'vessels', 'seatimes', 'certificates', 'sea_references',
    'tenders', 'achievements', 'navigation_areas', 'onboard_experiences',
    'hobbies_interests', 'specialist_qualifications', 'payslips'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets + upload policies (Phase 1 demo)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('profile-photos', 'profile-photos', true),
  ('vessel-photos', 'vessel-photos', true),
  ('vessel-documents', 'vessel-documents', true),
  ('certificate-files', 'certificate-files', true),
  ('reference-files', 'reference-files', true),
  ('seatime-files', 'seatime-files', true),
  ('achievement-files', 'achievement-files', true),
  ('tender-photos', 'tender-photos', true),
  ('onboard-experience-files', 'onboard-experience-files', true),
  ('hobbies-interest-photos', 'hobbies-interest-photos', true),
  ('specialist-qualification-files', 'specialist-qualification-files', true),
  ('payslip-files', 'payslip-files', true)
on conflict (id) do update set public = excluded.public;

do $$
declare
  bucket text;
begin
  foreach bucket in array array[
    'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
    'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
    'onboard-experience-files', 'hobbies-interest-photos',
    'specialist-qualification-files', 'payslip-files'
  ]
  loop
    execute format('drop policy if exists %I on storage.objects', bucket || '_select');
    execute format(
      'create policy %I on storage.objects for select to anon, authenticated using (bucket_id = %L)',
      bucket || '_select',
      bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_insert');
    execute format(
      'create policy %I on storage.objects for insert to anon, authenticated with check (bucket_id = %L)',
      bucket || '_insert',
      bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_update');
    execute format(
      'create policy %I on storage.objects for update to anon, authenticated using (bucket_id = %L)',
      bucket || '_update',
      bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_delete');
    execute format(
      'create policy %I on storage.objects for delete to anon, authenticated using (bucket_id = %L)',
      bucket || '_delete',
      bucket
    );
  end loop;
end $$;
