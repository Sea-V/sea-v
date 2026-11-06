-- =============================================================================
-- SEA-V -- limits and running cost for "Upload my CV" (v625)
-- =============================================================================
--
-- Jack, 2026-11-06: start building the CV upload (plan:
-- docs/product/cv-upload-plan-2026-11-05.md). One row per read: who, when, the model
-- and the tokens used. It holds NOTHING from the CV. The edge function cv-read writes
-- it with the service role and counts it for the daily limit; members can only read
-- their own rows, so it also comes out in Download my data.
--
-- Deleted with the account. The function removes a member's rows older than 30 days.
--
-- APPLIED + SMOKE-TESTED 2026-11-06 (Supabase MCP apply_migration cv_read_log):
-- see the v625 entry in CLAUDE.md. test-supabase.mjs: testCvReadLogPrivate.
-- =============================================================================

create table public.cv_read_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  file_kind text not null check (file_kind in ('pdf', 'word')),
  ok boolean not null default false,
  model text,
  input_tokens integer,
  output_tokens integer
);

create index cv_read_log_user_idx on public.cv_read_log (user_id, created_at desc);

alter table public.cv_read_log enable row level security;
revoke all on public.cv_read_log from anon, authenticated;
grant select on public.cv_read_log to authenticated;

create policy cv_read_log_own_read on public.cv_read_log
  for select to authenticated using (user_id = (select auth.uid()));
create policy mfa_required on public.cv_read_log
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
