# SEA-V — Data protection impact assessment (DPIA)

UK GDPR / EU GDPR article 35. Last reviewed 8 October 2026 by Jack Sorrell.
Review again before any major new feature (e.g. a recruiter search, a shared
vessel register, analytics, or anything that matches or scores people).

## 1. Is a full DPIA required?

Checked against the ICO's list of processing likely to be high risk:

| ICO criterion | SEA-V | |
|---|---|---|
| Special-category data on a large scale | Medical fitness certificates (health) — optional, per member, small scale | Borderline → assess |
| Systematic monitoring / tracking | No tracking, no analytics, no location tracking (passages are entered by hand) | No |
| Profiling or automated decisions with significant effects | Sea-time and milestone calculations are guidance only; no decisions made about people | No |
| Data about vulnerable people / children | Adults (16+); seafarers are not a vulnerable group as such | No |
| Data matching / combining datasets | No | No |
| Invisible processing | Referees' details come from the member — addressed by the notice in the email | Assess |
| Publication of personal data | Optional public profile | Assess |
| New technology | No | No |

**Conclusion:** probably not mandatory, but three items (health data,
publication, referees) justify doing a short one. Done below.

## 2. What the processing is

Crew record their career (vessels, sea time, certificates, passages,
references, payslips and documents) to track MCA sea-time progress, build a
CV, and optionally publish a public profile. Data is stored in Supabase
(London). Full detail: `record-of-processing.md`.

**Necessary and proportionate?** Yes — every field serves the member's own
career record or CV. Sensitive items (salary, payslips, passport numbers,
certificate numbers, medical files) are private by design and never
published. No data is sold, used for advertising, or used to train AI.

## 3. Risks and measures

Likelihood × severity: Low / Medium / High.

| # | Risk to people | Before measures | Measures in place | Residual |
|---|---|---|---|---|
| 1 | Another member or an outsider sees private documents (payslips, SEAs, passports, medical certificates) | High | Row-level security on every table; private buckets, folder-only reads (fixed 8 Oct 2026); signed short-lived file links; security advisor checked after every change; regression tests in `scripts/test-supabase.mjs` | Low |
| 2 | Account takeover (stolen or reused password) exposes everything | Medium | Optional two-step login enforced in the database; leaked-password protection (_to confirm in Supabase_); self-service sign-out via password reset | Low–Medium (until most members turn on two-step login) |
| 3 | Health data (ENG1) disclosed or used against the member | Medium | Explicit consent at upload, timestamped; file private; public profile shows only "Held" — no dates or status. _Known gap: the public API still returns ENG1 dates; the page hides them. Close with a database view if this becomes a concern_ | Low |
| 4 | Member publishes more than they meant to; profile found via search engines | Medium | Public profile off by default; clear list of what shows; can be turned off instantly; search-engine visibility stated in the policy; owner sees "Only you can see this" on empty sections | Low |
| 5 | Referees' details used without their knowledge, or the email used for spam/harassment | Medium | Notice in the email; single-use 14-day link; rate limits (10/member, 3/reference, 5/address per day); referee email and CoC never public; links and declined references deleted automatically | Low |
| 6 | Data kept longer than needed | Medium | Daily automatic clean-up; self-service deletion; retention stated in the policy. _Inactive-account deletion still to automate (first due May 2029)_ | Low |
| 7 | Transfers outside the UK (Vercel, Resend in the US) | Low | Providers' DPAs with UK IDTA / SCCs; only minimal data (requests; referee name and email) leaves the UK | Low |
| 8 | Member cannot get their data out or exercise rights | Low | Download my data (full ZIP incl. files); complaints process; one-month response | Low |
| 9 | Inaccurate sea-time figures relied on for an MCA application | Medium | Figures are labelled guidance only in the terms; the MCA decides; calculations checked against MSN 1858 | Low |

## 4. Outcome

No high residual risk remains, so prior consultation with the ICO is not
needed. Actions still open (owner: Jack):

- [ ] Confirm leaked-password protection is on (Supabase → Authentication)
- [ ] Sign / accept processor DPAs (Supabase, Sentry; confirm Vercel, Resend)
- [ ] Appoint an EU representative and name them in the privacy policy
- [ ] Automate inactive-account deletion before May 2029
- [ ] Decide whether to close the ENG1-dates API gap (risk 3)

**Signed off:** Jack Sorrell — date: ____________
