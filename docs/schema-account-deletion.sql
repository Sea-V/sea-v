-- Self-service account deletion (run in Supabase SQL Editor after schema-phase2.sql)
-- Deletes the auth user; profile and related rows cascade when FKs use ON DELETE CASCADE.

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

  -- Remove storage objects owned by this user (path prefix = user id)
  delete from storage.objects
  where (storage.foldername(name))[1] = uid::text;

  -- Profile + child tables (user_id FK) — ensure ON DELETE CASCADE on schema-phase2 tables
  delete from public.profile where user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
