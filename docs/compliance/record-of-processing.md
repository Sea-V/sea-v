# SEA-V — Record of processing activities

UK GDPR / EU GDPR article 30. Keep this current: update it whenever SEA-V
starts collecting something new, adds a provider, or changes how long data
is kept. The ICO can ask to see it.

| | |
|---|---|
| **Controller** | Jack Sorrell, trading as SEA-V |
| **Contact** | admin@sea-v.com |
| **Postal address** | _To add (PO box / virtual office — not a home address)_ |
| **EU representative (art. 27)** | _To appoint — SEA-V serves crew living in the EU_ |
| **Data protection officer** | Not required (no large-scale special-category processing, not a public body) |
| **ICO registration** | _To add once the data protection fee is paid_ |
| **Last reviewed** | 8 October 2026 |

---

## 1. Member accounts and career records

| | |
|---|---|
| **Purpose** | Run the account; store and present the member's career records (vessels, sea time, certificates, passages, tenders, onboard experience, specialist qualifications, interests, land-based roles, payslips, references); calculate sea time and milestone progress; build their CV |
| **Lawful basis** | Contract (art. 6(1)(b)) — providing the service the member signed up for |
| **People** | Registered members (yacht crew, 16 and over) |
| **Data** | Name, email, phone, photo, date of birth, nationality, passports and visas held (countries only), location, rank, availability, career records and the files uploaded with them, employment agreements, salary and leave package, payslips |
| **Special category** | Medical fitness certificates (ENG1 / ML5) — health data. Basis: explicit consent (art. 9(2)(a)), ticked at upload and timestamped (`healthConsentAt`). Public profile shows only that one is held |
| **Recipients** | Processors only (section 7) |
| **Retention** | While the account is active. Deleted at once and in full by Profile settings → Delete my account. Inactive accounts: warning email after 3 years without a sign-in, deleted 30 days later (_policy stated; automation still to build — nothing can fall due before May 2029_) |

## 2. Public profile

| | |
|---|---|
| **Purpose** | Let a member publish a career profile to employers, by their own choice |
| **Lawful basis** | Consent (art. 6(1)(a)) — off by default; turned on and off by the member |
| **People** | Members who turn it on; anyone who visits the link |
| **Data published** | As listed in privacy.html section 05. Never published: email, phone, date of birth, salary, leave, passport/visa numbers, payslips, employment agreements, certificate numbers/issuers/files, CV choices, referees' emails and CoC numbers, medical certificate dates |
| **Note** | Public profiles can be indexed by search engines (stated in the privacy policy) |
| **Retention** | Removed from SEA-V the moment it is turned off or the account is deleted |

## 3. Referees

| | |
|---|---|
| **Purpose** | Send a verification request to a referee the member names, and record their answer |
| **Lawful basis** | Legitimate interests (art. 6(1)(f)) — the member's interest in a verified reference; the referee chooses whether to respond |
| **People** | Referees (captains, officers, employers) |
| **Data** | Name, email (from the member); if they confirm: name, rank, reference text, note, date, signature, optional CoC number |
| **Notice (art. 14)** | The verification email says the member supplied their details, what they are used for, and links to privacy.html#referees |
| **Safeguards** | Single-use link, 14-day expiry; at most 5 requests to one address per 24 hours; email address and CoC number never public |
| **Retention** | Links deleted 90 days after expiry; a declined reference deleted 1 year after it was declined (automatic, daily); a confirmed reference stays with the member's account |

## 4. Support, issue reports and complaints

| | |
|---|---|
| **Purpose** | Answer support and data protection requests; fix problems; handle complaints (DUAA s.164A, in force 19 June 2026) |
| **Lawful basis** | Legitimate interests (running and fixing the service); legal obligation for rights requests and complaints |
| **People** | Members and anyone who emails |
| **Data** | Message, the page it was sent from, app version, the account it came from, email correspondence |
| **Retention** | Report an issue messages deleted after 2 years (automatic). Emails: keep only as long as the matter is open plus 2 years |

## 5. Security and error monitoring

| | |
|---|---|
| **Purpose** | Keep the service secure and working |
| **Lawful basis** | Legitimate interests |
| **Data** | Error reports (Sentry, EU: `userInfo: false`, no request bodies); anonymous page-speed figures (Vercel Speed Insights, no cookies); sign-in records kept by Supabase Auth |
| **Retention** | Per the provider plan — check the event retention shown in Sentry settings and note it here |

## 6. Cookies and device storage

No cookies. Browser storage is used only for things the service needs
(sign-in session, a short-lived records cache, the CV draft, small display
preferences) — exempt under PECR as strictly necessary. Full list in
privacy.html section 10. **Adding any analytics, tracker or marketing email
changes this — update the policy first.**

---

## 7. Processors and other recipients

| Provider | What it does | Data | Location | Transfer safeguard | DPA |
|---|---|---|---|---|---|
| Supabase | Database, sign-in, file storage, email function | Everything in sections 1–4 | London (eu-west-2) | None needed (UK) | _To request in the Supabase dashboard_ |
| Vercel | Hosts the website | Requests (IP, pages) | US / global edge | Vercel DPA (UK IDTA / EU SCCs) | Part of Vercel terms — confirm |
| Resend | Sends the referee email | Referee name and email, member's name | US | Resend DPA (SCCs + UK addendum) | Part of Resend terms — confirm |
| Sentry | Error monitoring | Error details, browser info | Germany (EU) | None needed (UK adequacy for EU) | _To accept in Sentry settings; check Session Replay is off_ |
| cdnjs (Cloudflare), jsDelivr, unpkg | Serve open-source code libraries | IP address of the visitor's browser | Global | Independent providers | n/a |
| CARTO / OpenStreetMap | Map tiles for passages | IP address | Global | Independent providers | n/a |

## 8. Security measures (art. 32)

- Row-level security on every table; members can only reach their own rows.
- Public visitors can read only listed columns of members who turned their
  profile on (column-scoped grants).
- All 13 storage buckets are private; members read only their own folder
  (folder-only rule, 8 Oct 2026); public photos only from a public member's
  own folder; files are served through short-lived signed links.
- Optional two-step login (authenticator app), enforced in the database —
  a password-only session cannot read or change anything once it is on.
- Rate limits on the referee email (10 per member, 3 per reference, 5 per
  address, per 24 hours).
- Account deletion removes every row (cascade) and every file.
- HTTPS everywhere; Supabase encrypts data at rest.
- Automatic daily clean-up of expired data (section 3, 4).
- Security advisor checked after every database change.
