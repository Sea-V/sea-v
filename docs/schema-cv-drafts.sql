-- CV choices saved to the crew member's account (v561, Jack 2026-10-02).
--
-- Why: the CV generator's draft (template, headline, career overview, per-vessel
-- notes, which sections and which ITEMS appear) lived only in the browser's
-- localStorage, so it did not follow the crew member to another device and
-- was lost when the browser was cleared. Jack chose "save to your account",
-- and to make the CV generator the ONE place that decides what goes on the CV
-- (certificates included — the Certificates page tickbox is removed; its
-- show_on_cv=false values are carried into this draft on first load).
--
-- One row per user; the draft is the same JSON the page already builds
-- (js/cv-engine-model.js createDefaultDraft / syncDraftWithSource), plus
-- `choices` (per-item include/exclude). Private: owner-only RLS, nothing
-- granted to anon — the public profile never reads it. A future "Publish CV"
-- would add a separate, deliberately public snapshot, not open this table.
--
-- Size cap: a draft is a few KB (vessel notes are the bulk); 200 KB is far
-- above any real CV and stops the row being used as free storage.

create table if not exists public.cv_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint cv_drafts_draft_is_object check (jsonb_typeof(draft) = 'object'),
  constraint cv_drafts_draft_size check (octet_length(draft::text) <= 200000)
);

alter table public.cv_drafts enable row level security;

drop policy if exists cv_drafts_owner_all on public.cv_drafts;
create policy cv_drafts_owner_all
  on public.cv_drafts
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.cv_drafts from anon;
revoke all on public.cv_drafts from public;
grant select, insert, update, delete on public.cv_drafts to authenticated;

-- APPLIED 2026-10-02 as migration cv_drafts_account_storage. Smoke-tested as
-- the real `authenticated` role (JWT claims set, all rolled back): owner
-- insert/read/update OK; owner inserting a row for another user refused;
-- 210 KB draft refused by the size check; another user sees 0 rows and
-- updates/deletes 0; anon refused (42501). Via PostgREST with the anon key:
-- GET and POST both 401 / 42501. Security advisors 23 before and after,
-- none new. Covered on every run by testCvDraftsPrivate in
-- scripts/test-supabase.mjs.
