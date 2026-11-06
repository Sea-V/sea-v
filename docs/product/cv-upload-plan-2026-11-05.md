# Upload a CV and create records from it: plan

**Status:** started 2026-11-06 (v625). Built for Jack's admin account only: `/cv-upload.html`, not in the menu. Needs the API key before it can read anything. See "Before crew use it".

**The idea:** crew upload their current CV, AI reads it, they check what it found, and one click creates their vessel profiles, time onboard, certificates and so on.

**The check step is essential.** AI will sometimes misread a date or role, and these records end up on a CV that captains see.

## How it would work

1. **Upload:** "Upload my CV" sits in + Add and in the getting-started guide, and takes a PDF or Word file.
2. **Reading:** a small server function (a Supabase edge function) sends the file to an AI model, which returns the details in a fixed format. Ordinary rules can't do this reliably, because every CV is laid out differently.
3. **Check:** a screen lists everything found, with tick boxes and editable fields.
4. **Create:** only the ticked items are saved, using the same save code as the normal forms.

The file itself isn't stored unless the crew member chooses to keep it.

## What it can fill in

| From the CV | Result |
|---|---|
| Yachts, roles, dates, length, GT, flag | Vessel records, with time onboard worked out from the dates |
| Duties under each job | "Experience onboard" on that vessel |
| Certificates | Matched to the certificate list, with any expiry dates it finds |
| Summary, nationality, location | Profile fields, but only where they are blank |
| Land-based jobs and hobbies | Their own sections |

If a yacht already exists, it suggests updating that record rather than creating a duplicate.

## What it should not create

- **Sea time entries.** A CV gives dates, not sea, standby and yard days. The milestones also count signed-on dates from sea time entries (`computeOow36MonthsOnboard` in `js/seav-data.js`), so importing them could move someone towards an MCA milestone based on an unchecked CV. Instead, each imported yacht prompts "Log your time" with the yacht and dates already filled in.
- **References, at first.** They contain other people's contact details and could look verified when they aren't.

## Decisions and setup needed

- **AI provider:** the suggestion is Anthropic's Claude, written by Claude, so not a neutral view. It needs an account, an API key and billing.
- **Cost:** a rough estimate, not measured, is 10 to 15 cents per CV on the most capable model (Claude Opus 5.5) or under a cent on the cheapest (Claude Haiku 5.5). Prices were as listed on 2026-11-05, so check them again. Test accuracy on real CVs before choosing. SEA-V is free, so Jack pays this.
- **Limit:** for example 3 uploads a day per person.
- **Privacy:** CVs hold dates of birth, passport details and phone numbers, and this would be a new service handling them.
  - Crew need a clear notice before uploading.
  - Update `privacy.html` (it also says data is not used to train AI, so confirm that against the provider's terms).
  - Update `docs/compliance/record-of-processing.md` and `docs/compliance/dpia.md`.
  - Check the provider's data terms and where data is processed.

## Before crew use it

Nothing below is done, and the function refuses everyone but admins until the secret `CV_READ_OPEN` is `true`.

- **Real reads:** run it on real CVs with Jack's key. No real read has happened yet. Check accuracy against the two tests, and read the cost from `cv_read_log` (tokens per read), then choose the model (`CV_READ_MODEL`).
- **Privacy:** name the AI provider in `privacy.html`, `docs/compliance/record-of-processing.md` and `docs/compliance/dpia.md`, including where it processes data and its data terms. The policy says data isn't used to train AI, so confirm that against the provider's terms. The upload page's "we don't keep the file" must stay true.
- **Certificates with no date read "No Expiry",** on the page and the public profile, which an imported one can't honestly claim. It needs a "date to confirm" state.
- **"Use the 1st for now" has no reminder.** The mockup promised one. It needs a marker on the yacht and a Needs attention row.
- **Log your sea time doesn't pre-fill** the yacht, role and dates yet.
- **Records show on the public profile as soon as they're saved,** if it's switched on. Decide whether that is right.
- **Menu:** add "Upload my CV" to + Add and the guide.
- **Certificate list:** add Helideck Landing Officer, Able Seaman and PWC Instructor.

## Build order

1. Mock up the upload and check screens so Jack can react first.
2. Test accuracy on 5 to 10 real CVs in different layouts, including Jack's.
3. Build it for vessels and certificates first, then add the other sections.

## Test 1, 2026-11-06: Jack's own Word CV

Read by Claude in chat and compared with his public records. **Not a blind test:** the reader had already seen his records, and the CV is clean Word text. It shows what the feature must handle, not how accurate it is.

| Item | Result |
|---|---|
| Yacht names | 7 of 7 on the CV found. A yacht left off the CV (Oberon) can't be found |
| Start and end, to the month | 11 of 12 agree with the records. Grace's end month differs |
| Exact day | None: the CV gives months, the records hold days |
| Length | 3 of 7 agree exactly; the others are rounded or disagree (Senses 60 m v 59 m, Grace 83 m v 81 m) |
| Flag, GT, IMO, MMSI | Not on the CV |
| Certificates | 17 lines, 11 match a record, 6 new, 11 records not on the CV |
| Certificate dates | Only 2 of the 17 lines carry a date |

**What the check screen and rules need because of this:**
- One yacht can be several CV jobs (Senses is 3). Make one vessel record, but keep each role for "Log your time", as Master service counts only deck officer roles.
- Month-only dates ask for the day. Never fill it in silently.
- Picking the yacht from the directory fills the flag, GT and numbers. A name alone still never links (v609).
- Show a difference in length rather than choosing one.
- Near matches must not auto-match: Advanced Fire Fighting is not Fire Prevention and Fire Fighting. An unmatched line stays visible as a custom certificate.
- One line can be a duplicate of another (two lithium-ion lines).
- Referees' names and emails are left out. Date of birth is not imported.
- Contact details are shown to check, not trusted: this CV's email has a typo.
- A CV gives almost no certificate dates, so expiry reminders need the certificate photo idea.

## Test 2, 2026-11-06: another captain's designed PDF, with his agreement

A blind read of a real three-page, two-column CV: the reader had seen none of his records. There are no records to score against, so it was checked against the page itself by the same reader, and he should confirm it. Names and contact details are left out here on purpose.

| Item | Result |
|---|---|
| Jobs | 10 of 10, yacht, role and month read correctly from the page |
| Yachts | 10 jobs are 6 yachts, 8 separate stints |
| In the yacht directory by name | 2 of 6 (and a name alone cannot link) |
| Roles matching the position list as written | 2 of 7 |
| Certificates | 12 lines: 5 have a clear catalogue match, 1 is unclear, 6 would be custom |

**New rules this adds:**
- **Send the page, not only its text.** The PDF's text order is scrambled: section headings land after the jobs, and the sidebar after them.
- **Merging depends on gaps.** A role change with no gap is one vessel record. A return after working elsewhere is a new record on the same yacht.
- **Map roles, showing the original.** "Master" to Captain, "2nd Officer" to Second Officer. "Relief Bosun", "Leading Hand" and "Snr Deckhand/WaterSports" need the crew member to choose, as they affect the Master rules.
- **A sidebar line is not always a certificate.** "Commercially Endorsed" qualifies the line above, and "STCW'95" names a convention, not a course. Ask, never assume.
- **One line can be two catalogue items,** such as passenger safety and crowd management.
- **Health lines stay out:** vaccination status, smoking and tattoos are never imported. ENG1 is imported only with the existing medical consent step.
- **Expired items are normal in an old CV.** Show them as expired instead of hiding them, and question "current" wording.
- **Yachts disagree with themselves.** The same yacht is 75 m and 75.28 m in different jobs.
- **Duties can be stale:** "currently planning" under a past job. They need a read before saving.

**Still to test:** Canva, a scanned PDF, a very short CV, and how the real API model compares.

## Technical notes

- The AI service accepts PDFs directly. Word files need their text pulled out first.
- Keep the API key in Edge Functions secrets, never in the page. Check the member's sign-in and two-step login in the function, as `sea-testimonial` does.
- Treat everything read from a CV as untrusted text: escape it on the check screen, and save nothing without the crew member's tick.
- Any new table or column follows the Supabase rule in `CLAUDE.md`: applied live and smoke-tested in the same session.
