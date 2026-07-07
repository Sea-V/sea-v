-- =============================================================================
-- RUN ORDER: 2  |  SAVE AS IN SUPABASE: "2 - Auth and per-user security"
-- =============================================================================
-- SEA-V — Real user accounts + private data per user (Phase 2)
-- Prerequisite: schema-full.sql (step 1) already applied.
-- Enable Email auth first: Authentication → Providers → Email
-- See docs/SQL-SETUP-GUIDE.md for plain English.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add user_id to all tables (uuid — matches auth.users.id)
-- ---------------------------------------------------------------------------
alter table public.profile add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.vessels add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.seatimes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.certificates add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.sea_references add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tenders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.achievements add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.navigation_areas add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.onboard_experiences add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.hobbies_interests add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.specialist_qualifications add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.payslips add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- If a previous run created user_id as text, convert to uuid (nulls stay null)
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
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'user_id'
        and udt_name = 'text'
    ) then
      execute format(
        'alter table public.%I alter column user_id type uuid using nullif(trim(user_id::text), '''')::uuid',
        t
      );
    end if;
  end loop;
end $$;

-- Belt-and-suspenders: the ADD COLUMN IF NOT EXISTS ... REFERENCES lines
-- above only attach the FK when the column doesn't already exist yet. If a
-- table's user_id column was added by an earlier/separate migration before
-- this script ran, IF NOT EXISTS skips the whole clause -- including the
-- inline REFERENCES -- and the FK silently never gets created, with no
-- error. This happened live to public.vessels (fixed 2026-07-07). This
-- block explicitly ensures every table's FK exists regardless of how
-- user_id first got added, so this can't recur silently on any table.
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
    if not exists (
      select 1
      from pg_constraint c
      where c.conrelid = format('public.%I', t)::regclass
        and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
        t, t || '_user_id_fkey'
      );
    end if;
  end loop;
end $$;

create index if not exists profile_user_id_idx on public.profile (user_id);
create index if not exists vessels_user_id_idx on public.vessels (user_id);
create index if not exists seatimes_user_id_idx on public.seatimes (user_id);
create index if not exists certificates_user_id_idx on public.certificates (user_id);
create index if not exists sea_references_user_id_idx on public.sea_references (user_id);
create index if not exists tenders_user_id_idx on public.tenders (user_id);
create index if not exists achievements_user_id_idx on public.achievements (user_id);
create index if not exists navigation_areas_user_id_idx on public.navigation_areas (user_id);
create index if not exists onboard_experiences_user_id_idx on public.onboard_experiences (user_id);
create index if not exists hobbies_interests_user_id_idx on public.hobbies_interests (user_id);
create index if not exists specialist_qualifications_user_id_idx on public.specialist_qualifications (user_id);
create index if not exists payslips_user_id_idx on public.payslips (user_id);

-- ---------------------------------------------------------------------------
-- 2. Optional: migrate legacy demo row to your first auth user
--    Replace YOUR-AUTH-USER-UUID before running this block.
-- ---------------------------------------------------------------------------
-- update public.profile set id = 'YOUR-AUTH-USER-UUID', user_id = 'YOUR-AUTH-USER-UUID'::uuid where id = 'default-profile';
-- update public.vessels set user_id = 'YOUR-AUTH-USER-UUID'::uuid where user_id is null;
-- (...repeat for each table...)

-- ---------------------------------------------------------------------------
-- 3. Drop Phase 1 permissive policies
-- ---------------------------------------------------------------------------
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
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Owner policies (authenticated users only see/edit their rows)
-- ---------------------------------------------------------------------------
drop policy if exists "profile_owner_all" on public.profile;
drop policy if exists "profile_public_read" on public.profile;

create policy "profile_owner_all"
  on public.profile for all to authenticated
  using (auth.uid() = user_id or auth.uid()::text = id)
  with check (auth.uid() = user_id or auth.uid()::text = id);

create policy "profile_public_read"
  on public.profile for select to anon
  using (public_enabled = true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'vessels', 'seatimes', 'certificates', 'sea_references', 'tenders',
    'achievements', 'navigation_areas', 'onboard_experiences',
    'hobbies_interests', 'specialist_qualifications', 'payslips'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner_all',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select to anon using (
        exists (
          select 1 from public.profile p
          where p.user_id = %I.user_id
          and p.public_enabled = true
        )
      )',
      t || '_public_read',
      t,
      t
    );
  end loop;
end $$;

-- Payslips: never public — drop anon read
drop policy if exists payslips_public_read on public.payslips;

-- ---------------------------------------------------------------------------
-- 5. Storage — private buckets + owner-only paths ({user_id}/...)
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id in (
  'profile-photos', 'vessel-photos', 'vessel-documents', 'certificate-files',
  'reference-files', 'seatime-files', 'achievement-files', 'tender-photos',
  'onboard-experience-files', 'hobbies-interest-photos',
  'specialist-qualification-files', 'payslip-files'
);

-- Drop Phase 1 storage policies (names from schema-full.sql)
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
    execute format('drop policy if exists %I on storage.objects', bucket || '_insert');
    execute format('drop policy if exists %I on storage.objects', bucket || '_update');
    execute format('drop policy if exists %I on storage.objects', bucket || '_delete');
  end loop;
end $$;

-- Owner can read/write only inside their folder prefix
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
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_select');
    execute format(
      'create policy %I on storage.objects for select to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_select', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated
       with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_insert', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_update');
    execute format(
      'create policy %I on storage.objects for update to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_update', bucket
    );
    execute format('drop policy if exists %I on storage.objects', bucket || '_owner_delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      bucket || '_owner_delete', bucket
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Auto-create profile on signup (avoids client-side RLS insert failures)
--    Also run docs/schema-phase2-auth-trigger.sql if you already applied this file.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, user_id, name, email, public_enabled, updated_at)
  values (
    new.id::text,
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    false,
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    name = case
      when coalesce(excluded.name, '') <> '' then excluded.name
      else profile.name
    end,
    user_id = coalesce(profile.user_id, excluded.user_id),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Public profile files — anon read only for files attached to public rows
-- ---------------------------------------------------------------------------

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
    execute format('drop policy if exists %I on storage.objects', bucket || '_public_read');
  end loop;
end $$;

drop policy if exists profile_photos_public_read on storage.objects;
drop policy if exists vessel_photos_public_read on storage.objects;
drop policy if exists certificate_files_public_read on storage.objects;
drop policy if exists achievement_files_public_read on storage.objects;
drop policy if exists onboard_experience_files_public_read on storage.objects;
drop policy if exists hobbies_interest_photos_public_read on storage.objects;

create policy profile_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.profile p
      where p.public_enabled = true
        and p.user_id::text = (storage.foldername(storage.objects.name))[1]
        and p.photo->>'path' = storage.objects.name
    )
  );

create policy vessel_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'vessel-photos'
    and exists (
      select 1
      from public.vessels v
      join public.profile p on p.user_id = v.user_id
      where p.public_enabled = true
        and v.photo->>'path' = storage.objects.name
    )
  );

-- Intentionally no certificate_files_public_read policy: certificate
-- attachments are never linked from the public profile (see
-- docs/schema-phase2-public-hardening.sql for the reasoning), so there's
-- nothing for a public-read policy to serve.

create policy achievement_files_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'achievement-files'
    and exists (
      select 1
      from public.achievements a
      join public.profile p on p.user_id = a.user_id
      where p.public_enabled = true
        and a.status = 'Verified'
        and a.attachment->>'path' = storage.objects.name
    )
  );

create policy onboard_experience_files_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'onboard-experience-files'
    and exists (
      select 1
      from public.onboard_experiences oe
      join public.profile p on p.user_id = oe.user_id
      where p.public_enabled = true
        and oe.status = 'Signed Off'
        and oe.attachment->>'path' = storage.objects.name
    )
  );

-- NOTE: jsonb_array_elements()'s output column is named "value", not "photo"
-- -- a bare `photo->>'path'` silently resolves to the unrelated profile.photo
-- column instead of erroring, so this policy never actually matched a real
-- hobby photo. Must be photo.value->>'path'.
create policy hobbies_interest_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'hobbies-interest-photos'
    and exists (
      select 1
      from public.hobbies_interests h
      join public.profile p on p.user_id = h.user_id
      cross join lateral jsonb_array_elements(coalesce(h.photos, '[]'::jsonb)) photo
      where p.public_enabled = true
        and h.status = 'Published'
        and photo.value->>'path' = storage.objects.name
    )
  );
