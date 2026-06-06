-- Step 5a — Profile column privacy (run in Supabase SQL Editor)
-- Test after: node scripts/test-supabase.mjs --step 1

revoke all on table public.profile from anon;

grant select (
  id,
  user_id,
  name,
  rank,
  qualification,
  nationality,
  dob,
  location,
  availability,
  bio,
  photo,
  public_enabled,
  created_at,
  updated_at
) on table public.profile to anon;
