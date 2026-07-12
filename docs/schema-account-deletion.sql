-- Self-service account deletion (run in Supabase SQL Editor after schema-phase2.sql)
--
-- Storage files are NOT deleted here. Supabase blocks raw SQL
-- `DELETE FROM storage.objects` with "Direct deletion from storage tables
-- is not allowed. Use the Storage API instead." — an earlier version of
-- this function tried to do exactly that as its first statement, which
-- aborted the entire transaction and silently deleted nothing at all (not
-- the files, not the profile, not the auth user). Storage cleanup now
-- happens client-side, via the Storage API, in js/auth.js's
-- removeAllUserStorageFiles() — called before this RPC.
--
-- Every user-owned table (profile, vessels, certificates, seatimes,
-- achievements, navigation_areas, onboard_experiences, hobbies_interests,
-- specialist_qualifications, payslips, sea_references,
-- reference_verification_tokens) has a `user_id` foreign key to
-- auth.users(id) with ON DELETE CASCADE, so deleting the auth user cascades
-- through all of them automatically. Confirmed live via pg_constraint —
-- no need to delete each table individually here.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
