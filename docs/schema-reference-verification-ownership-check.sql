-- Reference verification — client-side ownership check
-- Run in Supabase SQL Editor after schema-reference-verification-referee-authored-text.sql
-- Safe to re-run
--
-- The self-signing guard added to complete_reference_verification[_v2/_v3]
-- (schema-reference-verification-block-self-signing.sql) checks
-- auth.uid() = token_row.user_id -- but verify-reference.js always calls
-- those RPCs through window.SeavPublicSupabase, a client created with
-- persistSession:false specifically so a real referee (who has no SEA-V
-- account) can call it anonymously. That client never carries a session, so
-- auth.uid() is always null inside those functions regardless of whether the
-- crew member is logged into their own account elsewhere in the same
-- browser -- the guard can never actually fire. Confirmed live: a crew
-- member completed their own reference successfully while logged in
-- (2026-07-28).
--
-- Real fix happens client-side instead (js/verify-reference.js
-- checkOwnSessionBlock): check the MAIN authenticated client's session
-- (window.SeavSupabase, which does persist/detect sessions) separately, and
-- if one exists, ask this RPC (grantable to `authenticated` only, so
-- auth.uid() means something) whether that logged-in account owns this
-- token. If so, the page is blocked outright before showing the form. Like
-- the DB guard, this is best-effort -- a private/incognito window still
-- bypasses it -- but it catches the common case: testing the link while
-- still signed in as yourself. The complete_* guard stays in place as
-- harmless defense-in-depth, not the primary protection.

create or replace function public.is_own_reference_verification_link(p_token text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_token_hash text;
  token_row public.reference_verification_tokens%rowtype;
begin
  if coalesce(trim(p_token), '') = '' then
    return false;
  end if;

  v_token_hash := public.hash_reference_verification_token(trim(p_token));

  select * into token_row
  from public.reference_verification_tokens t
  where t.token_hash = v_token_hash
  limit 1;

  if not found then
    return false;
  end if;

  return auth.uid() is not null and auth.uid() = token_row.user_id;
end;
$function$;

grant execute on function public.is_own_reference_verification_link(text) to authenticated;
