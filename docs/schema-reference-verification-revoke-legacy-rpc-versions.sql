-- Revoke EXECUTE on the two legacy reference-verification completion RPCs
-- from anon/authenticated. Applied to the live project on 2026-07-31 via
-- Supabase migration `revoke_legacy_reference_verification_rpc_execute`.
--
-- complete_reference_verification (v1, unversioned) and
-- complete_reference_verification_v2 predate the drawn-signature
-- requirement added in complete_reference_verification_v3 (see
-- docs/schema-reference-verification-signature.sql). All three still
-- correctly block self-verification (auth.uid() = token_row.user_id), but
-- only v3 requires and validates a signatureImage.
--
-- js/reference-verification.js's complete() only calls v1/v2 as a fallback
-- when v3's RPC can't be found at all (schema-cache lag right after a
-- migration) -- but that's not what made this a real gap. Because v1/v2
-- were still separately GRANT EXECUTE'd to anon+authenticated, anyone
-- holding a real (unused, unexpired) verification token could call the old
-- RPC directly via /rest/v1/rpc/complete_reference_verification[_v2] and
-- mark a reference "Verified" with just a typed name -- no drawn signature
-- -- completely bypassing the app's own UI and the v3 hardening.
--
-- Revoking EXECUTE (rather than dropping the functions) keeps the existing
-- client-side fallback code intact and harmless: if v3 is ever genuinely
-- missing, the fallback to v2/v1 will now fail with "permission denied"
-- instead of silently succeeding with the weaker check -- a loud failure
-- instead of a silent security downgrade, which is the right trade-off for
-- a security-relevant path.

revoke execute on function public.complete_reference_verification(text, jsonb) from anon, authenticated;
revoke execute on function public.complete_reference_verification_v2(jsonb) from anon, authenticated;
