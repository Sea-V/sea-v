-- bug_reports: members can read their OWN reports (GDPR right of access, v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- Report an issue writes a row with the member's user_id, message and the
-- page they were on — their personal data — but only bug_reports_admin_select
-- existed, so "Download my data" could not include it. Adds a read-only owner
-- policy. Members still cannot see anyone else's reports, and nothing about
-- insert/update/delete changes.

create policy bug_reports_owner_select on public.bug_reports
  for select to authenticated
  using (user_id = auth.uid());

-- SMOKE TEST 2026-10-08 (real authenticated role, a non-admin member with 1
-- report out of 3 in the table): member sees 1, others visible 0.
