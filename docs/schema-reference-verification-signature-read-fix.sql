-- Fix: verifying a reference and drawing a signature failed with
-- "new row violates row-level security policy" (toast: "Could not submit").
--
-- Root cause: the signature image upload (js/reference-verification.js
-- uploadSignatureImage()) calls the Supabase Storage client's upload(),
-- which issues an INSERT ... RETURNING under the hood. Postgres RLS
-- requires the newly-inserted row to also satisfy a SELECT (USING) policy
-- for RETURNING to succeed -- if it doesn't, Postgres raises the same
-- "violates row-level security policy" error rather than silently
-- omitting the row from the result.
--
-- The only SELECT policy covering verification-signatures/* paths was
-- reference_verification_allows_signature_read(), which only matches
-- AFTER sea_references.verification->>'signatureImage' has been set.
-- But that field is only set later, inside
-- complete_reference_verification_v3() -- which runs AFTER the signature
-- image has already been uploaded. This is a chicken-and-egg bug: the
-- very first upload could never satisfy its own read-back check, so
-- EVERY signed reference confirmation failed at the "Confirm reference"
-- step.
--
-- Fix: also allow the read while a valid (unused, unexpired) verification
-- token still points at this exact signature path -- mirroring the
-- existing write policy (reference_verification_allows_signature_write).
-- This unblocks the initial upload's RETURNING clause. Once
-- complete_reference_verification_v3() runs, the token is marked used
-- and sea_references.verification is set, so the original (already
-- correct) clause takes over for all subsequent reads.
--
-- Run this in the Supabase SQL Editor. Safe to re-run (CREATE OR REPLACE).

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
        and (
          auth.uid() is null
          or r.user_id = auth.uid()
        )
    )
    or exists (
      select 1
      from public.reference_verification_tokens t
      where t.used_at is null
        and t.expires_at > now()
        and p_object_path = 'verification-signatures/' || t.reference_id || '/' || t.id::text || '.png'
    );
$function$;
