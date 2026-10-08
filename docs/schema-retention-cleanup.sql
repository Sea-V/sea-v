-- Data retention: daily automatic clean-up (GDPR storage limitation, v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- Periods agreed with Jack 2026-10-08 ("do what you suggest"), and stated in
-- privacy.html section 08:
--   referee verification links   deleted 90 days after they expire
--   declined references          deleted 1 year after they were declined
--                                (rows with an uploaded file are left for a
--                                person to clean up: storage files cannot be
--                                removed from SQL)
--   bug reports                  deleted 2 years after they were sent
--   inactive accounts            NOT automated yet — policy: warning email
--                                after 3 years without a sign-in, deleted 30
--                                days later. Nothing can fall due before
--                                May 2029 (first account 2026-05-26); needs an
--                                email step, so it is a later job.
-- Nothing was due when this was applied (0 / 0 / 0).
--
-- Runs as a pg_cron job at 03:15 UTC every day. The function is SECURITY
-- DEFINER but EXECUTE is revoked from public/anon/authenticated, so only the
-- scheduler (postgres) can run it — it is not reachable over the API.

create extension if not exists pg_cron;

create or replace function public.run_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_tokens int;
  n_declined int;
  n_bugs int;
begin
  delete from public.reference_verification_tokens
  where expires_at < now() - interval '90 days';
  get diagnostics n_tokens = row_count;

  delete from public.sea_references
  where status = 'Declined'
    and updated_at < now() - interval '1 year'
    and attachment is null;
  get diagnostics n_declined = row_count;

  delete from public.bug_reports
  where created_at < now() - interval '2 years';
  get diagnostics n_bugs = row_count;

  return jsonb_build_object(
    'ran_at', now(),
    'verification_links', n_tokens,
    'declined_references', n_declined,
    'bug_reports', n_bugs
  );
end;
$$;

revoke all on function public.run_retention_cleanup() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'seav-retention-cleanup';
select cron.schedule('seav-retention-cleanup', '15 3 * * *', $$select public.run_retention_cleanup();$$);

-- SMOKE TEST 2026-10-08 (rolled back): one old + one recent row of each kind,
-- plus an old declined reference WITH a file; run_retention_cleanup()
-- returned {verification_links 1, declined_references 1, bug_reports 1};
-- every recent row and the with-file row remained. Job active, '15 3 * * *';
-- anon/authenticated EXECUTE false; REST call as anon -> 42501. pg_cron lives
-- in pg_catalog (no extension_in_public finding). Advisors 23 / 23.
