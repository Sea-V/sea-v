-- =============================================================================
-- SEA-V -- a crossing stamp can name the logged passage it was made on (v636)
-- =============================================================================
--
-- Jack, 2026-11-12: "Link a passage", so a self-declared crossing (Cape Horn,
-- Panama...) reads "✓ Logged passage" once the crew member points it at a
-- passage they logged on the Navigation page.
--
-- - achievements.navigation_area_id -> navigation_areas(id), ON DELETE SET NULL
--   (deleting the passage unlinks the stamp, it never deletes it).
-- - A trigger refuses a link to a passage the row's owner does not own. It runs
--   as the caller (security invoker), so RLS already hides other members'
--   passages; the check also covers a service-role write.
-- - anon may read the new column: the public profile shows the tag, and the
--   passage itself is already public through navigation_areas.
--
-- APPLIED + SMOKE-TESTED 2026-11-12 (Supabase MCP apply_migration
-- achievements_passage_link): see the v636 entry in CLAUDE.md.
-- =============================================================================

alter table public.achievements
  add column navigation_area_id text
    references public.navigation_areas(id) on delete set null;

create index achievements_navigation_area_id_idx
  on public.achievements (navigation_area_id);

create or replace function private.achievement_passage_owner_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.navigation_area_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.navigation_areas n
    where n.id = new.navigation_area_id and n.user_id = new.user_id
  ) then
    raise exception 'A crossing can only be linked to your own logged passage'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger achievements_passage_owner_guard
  before insert or update of navigation_area_id, user_id on public.achievements
  for each row execute function private.achievement_passage_owner_guard();

grant usage on schema private to authenticated;
grant execute on function private.achievement_passage_owner_guard() to authenticated;

grant select (navigation_area_id) on public.achievements to anon;
