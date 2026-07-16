-- Step 5a — Profile column privacy (run in Supabase SQL Editor)
-- Test after: node scripts/test-supabase.mjs --step 1

revoke all on table public.profile from anon;

grant select on table public.profile to authenticated;

grant select (
  id,
  user_id,
  name,
  rank,
  qualification,
  nationality,
  location,
  availability,
  bio,
  photo,
  public_enabled,
  created_at,
  updated_at
) on table public.profile to anon;
-- dob intentionally excluded: exact date of birth is an identity-theft risk
-- and the public profile UI never reads it. Revoked live 2026-07-16.
