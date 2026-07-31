-- Tighten reference_verification_allows_signature_read. Applied to the live
-- project on 2026-07-31 via Supabase migration
-- `tighten_reference_verification_allows_signature_read`.
--
-- Previously granted anonymous (auth.uid() is null) callers permanent,
-- non-expiring read access to ANY submitted signature image, as long as
-- they knew the exact storage path -- with no check of ownership or an
-- active verification token. That branch was broader than the product
-- currently needs: nothing renders a signature image publicly (checked
-- js/public-profile-sections.js -- no reference to signatureImage), only
-- the owner's private references page (js/references.js) and the live
-- verify-reference.html flow do.
--
-- Tightened to: the reference's OWNER can always read it (authenticated,
-- r.user_id = auth.uid()), or anyone holding a live (unused, unexpired)
-- verification token can read it during that verification window -- same
-- shape as the sibling reference_verification_allows_signature_write /
-- reference_verification_allows_file_read functions already use. Once a
-- verification completes (token used) or expires, anonymous read access to
-- that signature closes; only the owner can still see it.
--
-- Found during the 2026-07-31 full codebase audit.

create or replace function public.reference_verification_allows_signature_read(p_object_path text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    exists (
      select 1
      from public.sea_references r
      where coalesce(r.verification->'signatureImage'->>'path', '') = p_object_path
        and r.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.reference_verification_tokens t
      where t.used_at is null
        and t.expires_at > now()
        and p_object_path = 'verification-signatures/' || t.reference_id || '/' || t.id::text || '.png'
    );
$function$;
