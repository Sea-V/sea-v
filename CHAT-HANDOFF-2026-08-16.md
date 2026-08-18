# Chat handoff — 2026-08-16

Paste this into a new chat (or just say "read CHAT-HANDOFF-2026-08-16.md"). Memory + CLAUDE.md carry most context automatically; this covers what's specific to the last chat. Delete this file once absorbed.

## What the last chat shipped (2026-08-10)

**Automated referee verification email — live and confirmed working end-to-end.**
- `reference-verification` Edge Function deployed to Supabase (project bnjtrwmwyulvmsautssd), sends via Resend from `verify@sea-v.com`, light-branded template matching signup/reset-password emails.
- Manual copy-paste/share-link fallback **fully removed** — automated email is the only send path; failures show a hard error. This was Jack's explicit call ("a self-forwarded link doesn't hold currency").
- `REFERENCE_VERIFICATION_USE_EDGE_EMAIL: true`, ASSET_VERSION 479, committed as `73070d9` ("Automated referee verification email (v479)").
- Root cause of the initial "email failed": secrets were saved in Supabase **Vault** instead of **Edge Functions → Secrets** (different pages, easy to confuse). Now correctly set: `RESEND_API_KEY`, `REFERENCE_VERIFY_FROM_EMAIL`.
- Test send to admin@sea-v.com worked; ClickUp task 869egcpkr marked complete.

## Outstanding actions for Jack

1. **Push commit `73070d9` (v479) from your machine** — the sandbox can never push (403). Check it isn't already pushed; CLAUDE.md says HEAD is now v480, so it may be.
2. **Rotate the Resend API key** ("SEA-V Supabase SMTP") — the full key appeared in a chat screenshot. It's shared by two things, so after regenerating update it in **both**: Supabase Auth SMTP settings (signup/reset emails) and Edge Functions → Secrets → `RESEND_API_KEY`.

## Discrepancy to reconcile first

CLAUDE.md (updated 2026-08-15, i.e. AFTER the above) says a Resend "email failed" report is **still undiagnosed**, with diagnostic logging committed (`1afa3c4`) but not deployed, live function at version 5. The last chat confirmed emails working on 2026-08-10. Either a new failure appeared after the 10th, or CLAUDE.md's thread is stale. A new chat should check the Edge Function logs / send a test before assuming either. Note: the diagnostic logging logs `refereeEmail` in plain text (crew PII) — strip once root-caused.

## Requested but not started

- **Full review of all docs in `Sea-V Structure/` to list outstanding items** — Jack asked for this, then paused it due to usage limits. Good candidates to check: `SEA-V-Known-Gaps-Tracker.md`, the risk register, the 17-item codes site-tightening list, MSN 1858 Am.2 audit flag.

## Open items from the task list worth carrying

- Delete-tests on the test account: Vessels, Sea Time, Navigation, Tenders, Certificates, References, Specialist Quals, Payslips, Hobbies (Onboard Experience was in progress).
- Verify report-issue pilot end-to-end via SQL + admin.html access control (built, unverified).
- Verify moved Public-profile share panel (dashboard→profile) live in Chrome once pushed.
- #509 Reduce/reorganize Dashboard's 13 stacked accent cards.
- #528 CV Word export must match CV preview (colour + layout).
- #38/#39 NZ Maritime CoC research + full cert-catalog audit vs sources.
- #418 Per-page docs rollout (14 pages remaining).
- #439 Demo account: add photos to Hobbies & Interests.
- ClickUp: retry rate-limited updates (static pages + cross-cutting tasks).
- Known gap still open: `certificates.attachment` exposed to anon via table-wide grant (fix: re-apply column-scoped grant). `auth_leaked_password_protection` dashboard toggle still off.

## Process reminders (also in memory)

- Start a new chat per task; this chat died of size. Avoid pasting screenshots when text will do.
- Commit format `vNNN: description`; bump ASSET_VERSION + `node scripts/patch-html-scripts.mjs` (its own hardcoded ASSET_VERSION const must be bumped too) + eslint + `scripts/test-site.mjs` before every commit.
- Jack must push every commit himself.
