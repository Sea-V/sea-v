-- =============================================================================
-- SEA-V -- Only the verification flow may mark a reference Verified.
-- =============================================================================
--
-- THE BUG (found in the 2026-09-26 full audit)
-- --------------------------------------------
-- sea_references_owner_all is a plain owner-all policy, `authenticated` has
-- column INSERT/UPDATE on status, verification, reference_text and
-- reference_date, and there were no triggers. So a crew member could PATCH
-- their own reference to status = 'Verified' with any verification blob and
-- any reference text -- the trust signal SEA-V exists to provide, forged with
-- one request. All 3 live 'Verified' rows at the time (demo-r2/r3/r4) have a
-- null verification and no token: they were set directly, not by a referee.
--
-- THE FIX
-- -------
-- A BEFORE INSERT OR UPDATE trigger that, for the `authenticated`/`anon`
-- roles only, refuses to:
--   * put a reference INTO 'Sent for Verification' / 'Verified' / 'Declined'
--     (insert with one, or change status to one), or
--   * change verification / reference_text / reference_date while the row is
--     in one of those states.
-- The SECURITY DEFINER RPCs (request_reference_verification,
-- complete_reference_verification_v4, ...) run as their owner `postgres`, so
-- current_user is not authenticated inside them and they are unaffected.
--
-- Why this does not break the References page: js/references.js has exactly
-- one save path (saveReferenceData -> upsertItemById, one row), and it already
-- resets status to 'Draft' and clears verification + referee text whenever a
-- Sent/Verified/Declined reference is edited. Moving back to Draft, and
-- deleting, stay allowed.
--
-- NOT COVERED, deliberately: the referee link still reaches the crew member
-- (request_reference_verification returns the token so the edge function can
-- build the URL). That is the same trust boundary as the crew member typing
-- their own address as the referee email -- the flow verifies control of the
-- referee's mailbox, nothing more. Existing rows are not modified.
--
-- STATUS: applied to the live project and smoke-tested 2026-09-26
-- (migration name: sea_references_verification_guard).
-- =============================================================================

create or replace function public.guard_sea_reference_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked constant text[] := array['Sent for Verification', 'Verified', 'Declined'];
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.status = any (locked) then
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      raise exception 'Reference status "%" can only be set by the verification flow', new.status
        using errcode = '42501';
    end if;

    if new.verification is distinct from old.verification
       or new.reference_text is distinct from old.reference_text
       or new.reference_date is distinct from old.reference_date then
      raise exception 'A reference under verification cannot be edited; save it as a draft first'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_sea_reference_verification() from public, anon, authenticated;

drop trigger if exists sea_references_verification_guard on public.sea_references;

create trigger sea_references_verification_guard
  before insert or update on public.sea_references
  for each row
  execute function public.guard_sea_reference_verification();
