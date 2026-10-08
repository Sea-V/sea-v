# SEA-V — Breach plan, rights requests and account support

What to do, in order, when something goes wrong or someone asks for their
data. Written for one person running SEA-V. Last reviewed 8 October 2026.

---

## 1. Personal data breach

A breach is any security problem that leads to personal data being lost,
destroyed, changed, seen or shared when it should not be — by accident or
on purpose. Examples for SEA-V: a database or storage rule that lets one
member see another's files; a leaked key; a lost laptop with exports on it;
an email with someone's payslip sent to the wrong person.

**Within the first hour**
1. **Stop it.** Fix or switch off what is leaking (revert the rule, pause
   the feature, rotate the key, sign the account out in Supabase →
   Authentication → Users).
2. **Write down** in the log below: when you found it, what happened, what
   data, how many people, what you did. Keep timestamps. Do not delete
   evidence (logs, screenshots).

**Within 72 hours of becoming aware** — the clock starts when you are
reasonably sure a breach happened, not when you finish investigating.
3. **Decide whether to tell the ICO.** Report unless the breach is unlikely
   to result in a risk to anyone's rights (e.g. encrypted data, recovered
   before anyone saw it). When unsure, report. ICO: ico.org.uk → "Report a
   breach", or 0303 123 1113. You can report what you know and add detail
   later.
4. **EU members affected?** Also tell the EU authority via the EU
   representative (once appointed).

**Without undue delay**
5. **Tell the affected people** if the risk to them is high (e.g. payslips,
   passport details, medical certificates, or anything enabling fraud or
   identity theft). Plain language: what happened, what data, what you
   have done, what they should do (change password, turn on two-step
   login, watch for phishing that pretends to be verify@sea-v.com), and how
   to contact you.
6. **Processors:** if the breach is at Supabase, Vercel, Resend or Sentry,
   they must tell you; you still decide steps 3–5.

**Afterwards**
7. Fix the cause properly, add a test so it cannot come back, and note it in
   CLAUDE.md.

### Breach log

Record **every** breach here, including ones not reported to the ICO, with
the reason for not reporting.

| Date found | What happened | Data / people affected | Reported to ICO? (date / why not) | People told? | Fix |
|---|---|---|---|---|---|
| 2026-10-08 | Storage rules let a member read another member's file if they first saved that file's path into their own record (12 buckets), and let a public profile point visitors at another member's photo (5 buckets) | No data seen: checked all 159 stored file paths — none pointed outside its owner's folder. No breach occurred; vulnerability closed before use | No — no personal data was accessed (vulnerability, not breach) | No — no one affected | `docs/schema-storage-folder-only-reads.sql`, live 2026-10-08 |

---

## 2. Rights requests (access, correction, deletion, objection, portability)

1. **Self-service first.** Most requests are covered in the app:
   Download my data, edit any record, Delete my account, public profile on
   or off. Point the person there.
2. **Check identity.** Only act on a request from the account's registered
   email address, or after confirming identity another way. Never send data
   to an address that is not on the account.
3. **Deadline: one month** from receiving it (extendable by two months for
   complex requests — tell the person within the first month). Searches only
   need to be reasonable and proportionate.
4. **Free of charge.** Only refuse or charge if a request is manifestly
   unfounded or excessive — explain why, and that they can complain to the
   ICO.
5. **Referees** asking to be removed: delete their details from the
   reference (Supabase table `sea_references`) and tell the member the
   reference is no longer verified.
6. **Log it**: date in, who, what, date answered.

| Date in | Who | Request | Answered | Notes |
|---|---|---|---|---|
| | | | | |

---

## 3. Complaints (DUAA s.164A, in force 19 June 2026)

1. **Acknowledge within 30 days** of receiving it — any channel counts
   (email, Report an issue, social media).
2. Look into it properly and keep the person updated if it takes a while.
3. Tell them the outcome without undue delay, and that they can still go to
   the ICO (or, in the EU, their own authority).

| Date in | Who | Complaint | Acknowledged | Outcome / date |
|---|---|---|---|---|
| | | | | |

---

## 4. Lost two-step login device

A member who has lost their authenticator app cannot sign in. There are no
backup codes, so you remove the factor for them — **only after checking
it is really them**, because this is exactly what an attacker would ask
for.

1. The request must come from the account's registered email address.
2. Ask a question only the member could answer from their records (e.g.
   the name of a vessel they logged and its start month). Do not reveal the
   answer in the question.
3. Supabase dashboard → Authentication → Users → the user → remove the MFA
   factor (or SQL: `delete from auth.mfa_factors where user_id = '<id>';`).
4. Reply telling them to sign in with their password and turn two-step
   login back on in Profile settings. Log it in section 2.
