# SEA-V pre-launch worklist — 10 days

Generated 7 Jul 2026 after a full site regression pass. Everything below is either a real open item found today or a standard pre-launch check — nothing here is theoretical. Tick items off as you go; anything you want help with, just point me at it.

## Day 1 — Tue 7 Jul (today)

- [ ] Pull latest in Cursor and push to `main` — I can't push from my sandbox, so these are sitting local-only:
  - `e1ca8ad` Safari ocean-background filter fix
  - `d99369a` larger vessel card photos
  - `1af70fe` / `0b330e9` pastel-green pill colors
- [ ] Re-check your own "Animate app ocean background" commit (`34c5a38`) in Safari specifically — it touches the same `body.app-page::before` element the filter bug lived in, so worth a 30-second look before it's forgotten.
- [ ] Confirm the demo account (`demo.daniel.whitfield@sea-v-demo.com`) still looks right — I filled in the missing name today (`Daniel Whitfield`) after finding it blank; worth knowing why that account's `created_at` is today's date in case something is quietly recreating it.

## Day 2 — Wed 8 Jul — Auth hardening

- [ ] Toggle **Leaked Password Protection** on in Supabase Dashboard → Authentication → Policies. This has been flagged since the last audit and can only be turned on from the dashboard, not via SQL/MCP.
- [ ] Check Authentication → Emails → SMTP Settings: confirm you're on a **custom SMTP provider**, not Supabase's built-in mailer. The built-in one is rate-limited and explicitly not meant for production — if launch-day signups outpace it, confirmation emails silently stop sending.
- [ ] Test the password-reset flow once end-to-end (request reset → receive email → set new password → log in).
- [ ] Test the delete-account flow once on a throwaway account — confirm it actually removes/anonymizes what you expect.

## Day 3 — Thu 9 Jul — Reference verification

- [ ] Send yourself a real reference-verification link (add a test reference, use your own email as the referee) and click through the whole flow. The `reference_verification_tokens` table has zero rows ever — the flow has been code-reviewed but never actually exercised with a real click.
- [ ] Decide: keep the current "crew shares the link manually" behavior for launch (my recommendation — it works, it's simple, and the automated-email edge function doesn't exist yet), or commit to building/deploying it. Don't start that build unless you have real time for it.

## Day 4 — Fri 10 Jul — Mobile pass

- [ ] Click through every app page on an actual phone (iOS Safari + Android Chrome) — dashboard, all 13 domain pages, public profile. This session's regression pass was desktop-only.
- [ ] Check the photo upload flow on a real iPhone specifically (HEIC conversion) and a real Android phone.
- [ ] Check the navigation world map is usable with touch (pan/zoom/pinch).

## Day 5 — Sat 11 Jul — Cross-browser re-check

- [ ] Re-open every page in Safari on the Mac and compare against Chrome — same method as the transparency bug this week. Pay closest attention to anything with a background image, blur, or filter.
- [ ] Firefox pass if you have any users likely to be on it (lower priority than Safari given your userbase skews Mac/iPhone, but 10 minutes is cheap insurance).

## Day 6 — Sun 12 Jul — Security & data final pass

- [ ] Re-run the security advisor scan after Day 2's changes to confirm nothing new crept in.
- [ ] Check Supabase Storage bucket usage/quota against your plan limits — you've been uploading real photos and PDFs for months now.
- [ ] Spot-check RLS on any table you've touched since the last full audit (mid-session), if any.

## Day 7 — Mon 13 Jul — Performance & monitoring

- [ ] Run each main page through Chrome's Lighthouse/PageSpeed once — flag anything glaring (the ocean.png background image is large; worth confirming it's not tanking load time on slow connections).
- [ ] Decide if you want any error monitoring in place before launch (e.g. a lightweight tool that emails you when JS errors spike) — right now the only visibility into runtime errors is Supabase logs and users telling you directly.

## Day 8 — Tue 14 Jul — Content pass

- [ ] Proofread every page's copy top to bottom — dashboard, all domain pages, About, Privacy, Terms, Contact.
- [ ] Confirm Privacy Policy and Terms actually reflect what the product does today (photo storage, HEIC conversion, public profiles, reference verification, etc.) — these tend to drift out of date during active development.
- [ ] Confirm you have an actual process (even informal) for the "privacy and data subject requests" the Contact page explicitly invites — not just a technical capability but who reads that inbox and what they do.

## Day 9 — Wed 15 Jul — Soft launch dry run

- [ ] On a device with zero prior state (or a private browsing window), sign up as a brand new stranger would: create account → confirm email → build out a profile from scratch → generate a CV → toggle public profile on → share the link. Note anywhere it's confusing.
- [ ] Ask one person outside this project to do the same thing, unassisted, and watch where they get stuck.

## Day 10 — Thu 16 Jul — Launch day

- [ ] Final go/no-go: everything above either done or consciously deferred with a reason.
- [ ] Confirm the production deploy is on the correct branch and up to date (this bit you once before — a stale branch 187 commits behind).
- [ ] Watch the first real signups as they happen — Supabase Auth logs + the `auth.users` table are your fastest way to see if confirmation emails are actually landing.
