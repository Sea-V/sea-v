# Upload a CV and create records from it: plan

**Status:** parked by Jack on 2026-11-05, to come back to later. Nothing is built.

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

## Build order

1. Mock up the upload and check screens so Jack can react first.
2. Test accuracy on 5 to 10 real CVs in different layouts, including Jack's.
3. Build it for vessels and certificates first, then add the other sections.

## Technical notes

- The AI service accepts PDFs directly. Word files need their text pulled out first.
- Keep the API key in Edge Functions secrets, never in the page. Check the member's sign-in and two-step login in the function, as `sea-testimonial` does.
- Treat everything read from a CV as untrusted text: escape it on the check screen, and save nothing without the crew member's tick.
- Any new table or column follows the Supabase rule in `CLAUDE.md`: applied live and smoke-tested in the same session.
