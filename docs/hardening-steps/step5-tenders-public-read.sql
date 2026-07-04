-- Step 5e — Tenders on public profile (run in Supabase SQL Editor)
-- Required for anonymous visitors to see tenders + photos on public-profile.html

grant select (
  id, user_id, name, vessel_id, type, model, length, engine, capacity, reg,
  proficiency_level, description, photo, created_at, updated_at
) on table public.tenders to anon;

drop policy if exists tenders_public_read on public.tenders;
create policy tenders_public_read
  on public.tenders for select to anon
  using (
    exists (
      select 1 from public.profile p
      where p.user_id = tenders.user_id
        and p.public_enabled = true
    )
  );

drop policy if exists tender_photos_public_read on storage.objects;
create policy tender_photos_public_read
  on storage.objects for select to anon
  using (
    bucket_id = 'tender-photos'
    and exists (
      select 1
      from public.tenders t
      join public.profile p on p.user_id = t.user_id
      where p.public_enabled = true
        and t.photo->>'path' = storage.objects.name
    )
  );
