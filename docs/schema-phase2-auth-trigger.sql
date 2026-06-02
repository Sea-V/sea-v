-- =============================================================================
-- RUN ORDER: 3 (optional)  |  SAVE AS IN SUPABASE: "3 - Fix signup profile"
-- =============================================================================
-- SEA-V — Auto-create profile when a user signs up
-- Only if signup failed with "row level security", or step 2 was run before the trigger existed.
-- Prerequisite: schema-phase2.sql (step 2). See docs/SQL-SETUP-GUIDE.md
-- =============================================================================

-- Creates a profile row when auth.users gets a new user (security definer bypasses RLS).
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

-- Backfill profiles for auth users created before this trigger existed
insert into public.profile (id, user_id, name, email, public_enabled, updated_at)
select
  u.id::text,
  u.id,
  coalesce(u.raw_user_meta_data->>'name', ''),
  coalesce(u.email, ''),
  false,
  now()
from auth.users u
where not exists (
  select 1
  from public.profile p
  where p.user_id = u.id or p.id = u.id::text
);
