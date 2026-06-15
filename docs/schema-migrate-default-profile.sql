-- =============================================================================
-- Migrate legacy Phase 1 demo profile into your authenticated user row
-- =============================================================================
-- Use when you saved data under id = 'default-profile' before Phase 2 auth.
-- Replace YOUR-AUTH-USER-UUID with your UUID from Supabase → Authentication → Users.
-- Safe to re-run: only copies into empty fields on your user row.
-- =============================================================================

-- Example UUID for Jack Sorrell's account (update if yours differs):
-- ac09b28e-e429-4fe6-9d4a-516ed72ef7d8

do $$
declare
  uid uuid := 'YOUR-AUTH-USER-UUID'::uuid;
  legacy record;
  owner record;
begin
  select * into legacy from public.profile where id = 'default-profile';
  select * into owner from public.profile where id = uid::text;

  if legacy is null then
    raise notice 'No default-profile row — nothing to migrate.';
    return;
  end if;

  if owner is null then
    insert into public.profile (id, user_id, name, email, public_enabled, updated_at)
    values (uid::text, uid, coalesce(legacy.name, ''), coalesce(legacy.email, ''), false, now());
    select * into owner from public.profile where id = uid::text;
  end if;

  update public.profile
  set
    name = case when coalesce(owner.name, '') = '' then legacy.name else owner.name end,
    rank = case when coalesce(owner.rank, '') = '' then legacy.rank else owner.rank end,
    qualification = case when coalesce(owner.qualification, '') = '' then legacy.qualification else owner.qualification end,
    nationality = case when coalesce(owner.nationality, '') = '' then legacy.nationality else owner.nationality end,
    dob = coalesce(owner.dob, legacy.dob),
    location = case when coalesce(owner.location, '') = '' then legacy.location else owner.location end,
    email = case when coalesce(owner.email, '') = '' then legacy.email else owner.email end,
    phone = case when coalesce(owner.phone, '') = '' then legacy.phone else owner.phone end,
    passports_held = case when coalesce(owner.passports_held, '') = '' then legacy.passports_held else owner.passports_held end,
    visas_held = case when coalesce(owner.visas_held, '') = '' then legacy.visas_held else owner.visas_held end,
    salary = case when coalesce(owner.salary, '') = '' then legacy.salary else owner.salary end,
    availability = case when coalesce(owner.availability, '') = '' then legacy.availability else owner.availability end,
    bio = case when coalesce(owner.bio, '') = '' then legacy.bio else owner.bio end,
    photo = coalesce(owner.photo, legacy.photo),
    public_enabled = owner.public_enabled,
    updated_at = now()
  where id = uid::text;

  update public.vessels set user_id = uid where user_id is null;
  update public.seatimes set user_id = uid where user_id is null;
  update public.certificates set user_id = uid where user_id is null;
  update public.sea_references set user_id = uid where user_id is null;
  update public.tenders set user_id = uid where user_id is null;
  update public.achievements set user_id = uid where user_id is null;
  update public.navigation_areas set user_id = uid where user_id is null;
  update public.onboard_experiences set user_id = uid where user_id is null;
  update public.hobbies_interests set user_id = uid where user_id is null;
  update public.specialist_qualifications set user_id = uid where user_id is null;
  update public.payslips set user_id = uid where user_id is null;

  raise notice 'Migration complete for user %', uid;
end $$;
