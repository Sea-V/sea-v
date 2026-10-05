-- The "personal side" revamp (v572, Jack 2026-10-05).
--
-- Jack: crew should be able to show "a personal side to them with hobbies
-- like pictures, achievements within the hobbies ... self declared, like
-- ultra marathon completed, or hiked Kilimanjaro", and "skills and qualities
-- that would cross over with yachting ... working in a team, hard labour or
-- long hours, heavy lifting". Applies to interests, specialist
-- qualifications and a new land-based experience section.
--
-- Qualities are picked from a FIXED list in js/seav-data.js
-- (CREW_QUALITIES) so they can be counted into the profile's "Qualities"
-- strip; max 4 per item. Highlights are self-declared, max 8 per interest,
-- each {title, year}.
--
-- Public profile: years / highlights / qualities are granted to anon (the
-- public profile shows them). land_experiences is readable by anon only for
-- public_enabled owners, and its `attachment` (a reference letter) is NOT
-- granted to anon. The new bucket's read policy is folder-only — it does
-- not copy the older buckets' "path in one of my rows" branch (open audit
-- thread 9).

-- 1. Interests: years, highlights, qualities
alter table public.hobbies_interests
  add column if not exists years integer,
  add column if not exists highlights jsonb not null default '[]'::jsonb,
  add column if not exists qualities jsonb not null default '[]'::jsonb;
alter table public.hobbies_interests drop constraint if exists hobbies_interests_years_check;
alter table public.hobbies_interests add constraint hobbies_interests_years_check
  check (years is null or (years >= 0 and years <= 80));
alter table public.hobbies_interests drop constraint if exists hobbies_interests_highlights_check;
alter table public.hobbies_interests add constraint hobbies_interests_highlights_check
  check (jsonb_typeof(highlights) = 'array' and jsonb_array_length(highlights) <= 8);
alter table public.hobbies_interests drop constraint if exists hobbies_interests_qualities_check;
alter table public.hobbies_interests add constraint hobbies_interests_qualities_check
  check (jsonb_typeof(qualities) = 'array' and jsonb_array_length(qualities) <= 4);
grant select (years, highlights, qualities) on public.hobbies_interests to anon;

-- 2. Specialist qualifications: qualities
alter table public.specialist_qualifications
  add column if not exists qualities jsonb not null default '[]'::jsonb;
alter table public.specialist_qualifications drop constraint if exists specialist_qualifications_qualities_check;
alter table public.specialist_qualifications add constraint specialist_qualifications_qualities_check
  check (jsonb_typeof(qualities) = 'array' and jsonb_array_length(qualities) <= 4);
grant select (qualities) on public.specialist_qualifications to anon;

-- 3. Land-based experience
create table if not exists public.land_experiences (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default '',
  employer text not null default '',
  location text not null default '',
  date_from date,
  date_to date,
  is_current boolean not null default false,
  description text not null default '',
  qualities jsonb not null default '[]'::jsonb,
  attachment jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint land_experiences_qualities_check
    check (jsonb_typeof(qualities) = 'array' and jsonb_array_length(qualities) <= 4)
);
create index if not exists land_experiences_user_id_idx on public.land_experiences (user_id);

alter table public.land_experiences enable row level security;

drop policy if exists land_experiences_owner_all on public.land_experiences;
create policy land_experiences_owner_all on public.land_experiences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists land_experiences_public_read on public.land_experiences;
create policy land_experiences_public_read on public.land_experiences
  for select to anon
  using (exists (
    select 1 from public.profile p
    where p.user_id = land_experiences.user_id and p.public_enabled = true
  ));

revoke all on public.land_experiences from anon;
revoke all on public.land_experiences from public;
grant select, insert, update, delete on public.land_experiences to authenticated;
grant select (id, user_id, role, employer, location, date_from, date_to, is_current,
  description, qualities, created_at, updated_at) on public.land_experiences to anon;

-- 4. Private bucket for reference letters
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('land-experience-files', 'land-experience-files', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "land-experience-files_owner_select" on storage.objects;
create policy "land-experience-files_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'land-experience-files' and (storage.foldername(name))[1] = (auth.uid())::text);
drop policy if exists "land-experience-files_owner_insert" on storage.objects;
create policy "land-experience-files_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'land-experience-files' and (storage.foldername(name))[1] = (auth.uid())::text);
drop policy if exists "land-experience-files_owner_update" on storage.objects;
create policy "land-experience-files_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'land-experience-files' and (storage.foldername(name))[1] = (auth.uid())::text);
drop policy if exists "land-experience-files_owner_delete" on storage.objects;
create policy "land-experience-files_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'land-experience-files' and (storage.foldername(name))[1] = (auth.uid())::text);

-- APPLIED 2026-10-05 as migration personal_side_land_experience. Smoke-tested
-- as the real `authenticated` role (JWT claims set, rolled back): existing
-- hobbies / quals untouched (new columns default empty); owner insert +
-- read-back of a land role; inserting for another user refused; 5 qualities
-- refused; hobby years / highlights / qualities written, years 200 refused;
-- another user reads 0 land rows. curl as anon: land public columns 200,
-- land `attachment` 42501, anon insert 42501, hobbies + quals new columns
-- readable. Security advisors 23 before and after. Covered on every run by
-- PUBLIC_TABLE_SAFE_COLUMNS / sensitive-column probes in test-supabase.mjs.
