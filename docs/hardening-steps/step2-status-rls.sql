-- Step 5b — Status-aware public read policies (run in Supabase SQL Editor)
-- Test after: node scripts/test-supabase.mjs --step 2

drop policy if exists sea_references_public_read on public.sea_references;
create policy sea_references_public_read
  on public.sea_references for select to anon
  using (
    status = 'Verified'
    and exists (
      select 1 from public.profile p
      where p.user_id = sea_references.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists achievements_public_read on public.achievements;
create policy achievements_public_read
  on public.achievements for select to anon
  using (
    status = 'Verified'
    and exists (
      select 1 from public.profile p
      where p.user_id = achievements.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists onboard_experiences_public_read on public.onboard_experiences;
create policy onboard_experiences_public_read
  on public.onboard_experiences for select to anon
  using (
    status = 'Signed Off'
    and exists (
      select 1 from public.profile p
      where p.user_id = onboard_experiences.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists hobbies_interests_public_read on public.hobbies_interests;
create policy hobbies_interests_public_read
  on public.hobbies_interests for select to anon
  using (
    status = 'Published'
    and exists (
      select 1 from public.profile p
      where p.user_id = hobbies_interests.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists tenders_public_read on public.tenders;
drop policy if exists payslips_public_read on public.payslips;
