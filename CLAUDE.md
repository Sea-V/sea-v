# SEA-V — project memory

Read this first. It exists so a new chat can start work without re-reading the repo.

## What it is
SEA-V (sea-v.com) — maritime career platform for yacht crew. Crew log sea time,
certificates, vessels, navigation, payslips; generate a CV; publish a public
profile; collect verified references from past employers.

## Stack
- Front end: **plain HTML + vanilla ES modules. No framework, no build step.**
  One `.html` per page at repo root, one or more `js/*.js` modules per page.
- Backend: **Supabase** project `sea-v` (ref `bnjtrwmwyulvmsautssd`, eu-west-2).
  17 tables, RLS enabled on all. Auth + Storage + one edge function.
- Edge function: `supabase/functions/reference-verification/index.ts` (Deno).
  Sends referee emails via **Resend**.
- Hosting: Netlify (`netlify.toml`) / Vercel (`vercel.json`).
- Tooling: eslint only. `npm test` = `scripts/test-site.mjs` + `scripts/test-supabase.mjs`.
  CI: `.github/workflows/ci.yml`.

## Layout
- `js/api-core.js`, `api.js`, `api-mappers.js` — all Supabase reads/writes. Data
  access goes here, not in page modules.
- `js/seav-*.js` — shared UI/util (cards, badges, config, upload, share, notifications).
- `js/cv-engine*.js` — CV model / render / docx export.
- `js/navigation-*.js` — passage-planning feature, split across ~8 modules.
- `css/` — `core/`, `components/`, `pages/`, `responsive/`. Add to the right layer.
- `docs/*.sql` — every schema change, one file per migration, applied by hand.
- `scripts/` — generators (badges, SEO head, script tags) + test harnesses.

## Conventions
- Commits: `vNNN: short description`. Increment every commit.
- **Release checklist — run in this order, every commit. Do NOT hand-edit
  `?v=` query strings:**
  1. Bump `ASSET_VERSION` in `js/seav-config.js` AND the duplicated
     `const ASSET_VERSION` in `scripts/patch-html-scripts.mjs`. They must
     match — the script rewrites every query string from its own constant,
     so a stale value silently reverts the bump.
  2. `node scripts/patch-html-scripts.mjs`
  3. `npm run lint`
  4. `node scripts/test-site.mjs` (needs a local server:
     `python3 -m http.server 8765`)
- **Anything that touches Supabase or storage MUST be applied to the live
  project and smoke-tested in the same session — never left as a .sql file
  for later (Jack's standing rule, 2026-08-21).** The order is:
  1. Write a new `docs/schema-*.sql`. Never edit an old migration file.
  2. Apply it (Supabase MCP `apply_migration`, or by hand).
  3. Smoke-test it: existing rows unchanged, a write/read/revert round trip,
     and — for anything the public profile reads — that anon can see the new
     column and still cannot see the private ones.
  4. Run `get_advisors` (security) and confirm no NEW findings.
  5. Extend `scripts/test-supabase.mjs` so the change is covered on every
     future run, then note in the .sql header that it was applied and tested.
- **anon's SELECT on every table is COLUMN-SCOPED.** A new column is invisible
  to the public profile until `grant select (col) on <table> to anon` runs, and
  it must also be added to `PUBLIC_ARRAY_COLUMNS` in `js/api.js`. Deliberately
  ungranted today: `vessels.salary`, `vessels.leave_package`,
  `certificates.attachment`, `certificates.certificate_number`,
  `certificates.issuing_authority`, `certificates.training_provider`,
  `certificates.show_on_cv`, `sea_references.email`,
  `sea_references.message_to_referee`, `sea_references.verification` (raw —
  the public profile reads the redacted `verification_public` instead), and
  the sensitive `profile` fields.
- **The reverse trap bites just as hard: PostgREST plans the whole select list
  up front, so ONE ungranted column fails the ENTIRE query with 42501** — it
  does not silently drop that column. And `fetchSupabaseArray` only dispatches
  `seav:fetch-error` when `options.public` is false, so on the public profile
  the section just renders empty. `sea_references` lost its entire References
  section this way from 2026-08-01 to 2026-09-18. `testPublicColumnDrift()` in
  `scripts/test-supabase.mjs` now fails the suite if `PUBLIC_TABLE_SAFE_COLUMNS`
  there ever drifts from `PUBLIC_ARRAY_COLUMNS` in `js/api.js` again.
- **`scripts/test-supabase.mjs` cannot be *executed* from this sandbox —
  `node` is not on PATH** (nor is `npm`, so `npm run lint` cannot run either).
  Jack runs both from Cursor. **The network, however, is NOT the blocker:
  corrected 2026-09-18 — the sandbox DOES have egress to `*.supabase.co`.**
  Plain `curl` against `/rest/v1/...` with the anon key from `js/supabase.js`
  works, and it is the highest-fidelity check available: it exercises the real
  PostgREST path including column-scoped grants, which a Supabase MCP
  `execute_sql` (run as a superuser) does NOT. Use curl-as-anon to verify
  anything public-facing; use the MCP for schema, policies and advisors.
- **Line endings are mixed across the repo — 77 tracked files are CRLF**
  (`js/vessels.js`, `js/supabase.js`, `js/auth.js`, `js/tenders.js`,
  `js/navigation-*.js`, `js/seav-config.js`, most of `docs/*.sql`,
  `scripts/*.mjs`, several `css/` files, and more). A naive read/write
  reformats the whole file into a thousand-line diff, and a `\n` search
  pattern silently fails to match. Check first:
  `git ls-files -z | xargs -0 file | grep CRLF`
  Or edit line-ending-agnostically: read bytes, note whether `\r\n` is
  present, normalise to `\n` to match, restore on write. `sed -i` is safe —
  it is line-oriented and leaves the `\r` alone.
- Keep page modules thin; shared logic goes in `seav-*` or `api*`.

## Design standards — READ BEFORE ANY CSS OR UI EDIT

These are not suggestions. They predate this file by months and they are the
thing most easily broken by an agent that starts editing without looking.

**Source of truth, in order:**
1. `.cursor/rules/field-label-typography.mdc` — marked `alwaysApply: true`.
   Entity names white, field labels blue `#5bbcff`, values white. Accents
   (silver/green/purple) belong on borders and icons, never on label text.
2. `.cursor/rules/meta-grid-card-layout.mdc` — meta-grid card structure.
3. `css/core/typography.css` — the scale. Stated philosophy: *system font,
   normal case, one body size; page titles only larger.*
4. `css/core/variables.css` — the tokens.

**Tokens — use these, never a raw value:**

| Token | Value | Use |
|---|---|---|
| `--font-body` | 14px | body copy |
| `--font-page-title` | 18px | page title |
| `--font-section-title` | 14px | section heading |
| `--font-label` | 11px | field / footnote labels |
| `--font-value` | 14px | field values |
| `--font-kpi` | 22px | KPI numbers |
| `--font-weight-body` / `--font-weight-title` | 600 / 800 | weights |
| `--seav-entity-name-color` | #ffffff | vessel/tender/yacht names |
| `--seav-field-label-color` | #5bbcff | field labels |
| `--seav-field-value-color` | #ffffff | field values |
| `--seav-meta-desc-color` | rgba(255,255,255,0.78) | descriptions |
| `--seav-note-color` | rgba(255,255,255,0.60) | supporting notes / footnotes |
| `--seav-meta-muted-color` | rgba(255,255,255,0.45) | muted meta |

**Checklist before editing any stylesheet:**
- Read the two `.cursor/rules/*.mdc` files first. Every time.
- Reach for a token. If no token fits, add one to `variables.css` — do not
  hardcode a new magic number.
- Check specificity before writing a new rule. `css/core/layout.css` has
  `.dash-card p`, `.dash-card h3` etc. at (0,1,1); a bare page class (0,1,0)
  loses to them silently and the declarations just vanish.
- Matching a neighbouring rule is NOT the same as following the standard.
  Parts of the codebase predate the tokens (e.g. `.seatime-section-head p`
  hardcodes 13px). Follow the standard, not the neighbour.
- Existing CSS comments record *why* a value was chosen and often name the
  date the user asked for it. Read them before overriding — they are the
  history of decisions already litigated.

**Layout gutters:** a page shell uses one side gutter throughout. Seatime is
28px (`.seatime-shell-head`, `.seatime-section`, `.seatime-shell-card
.dash-kpis-row`). `.dash-card` defaults to 18px from `layout.css`, so any
`.dash-card` inside a page shell needs its padding overridden or it sits
10px out of line.

## Current state (2026-09-20)
- HEAD = **v527**. Jack pushes every commit himself from
  Cursor — this sandbox cannot push (403), and committing from it leaves stale
  `.git/*.lock` files it has no permission to delete. **Write files here;
  commit in Cursor.**
- Referee verification email is **live and working** (confirmed 2026-08-10).
  Sends via Resend from `verify@sea-v.com`. The manual share-link fallback was
  deliberately removed — the automated email is the only send path. The earlier
  "email failed" report was root-caused to secrets saved in Supabase **Vault**
  rather than **Edge Functions → Secrets**; no code fix was needed.

### Shipped today (v481–v494)
- **Sea-time maths corrected against MSN 1858.** The 36-month OOW figure was
  double-counting watchkeeping and ignoring the 90-day yard cap — it unlocked
  at 1269 days against a 1095 target when the true figure was 1063. Added the
  §4.1 five-year recency rule. Cert-gated service is now pro-rated for
  contracts straddling the certificate issue date, and Master watchkeeping is
  gated to service performed while holding OOW (the Sea Time tracker was
  changed to match, not the badge).
- **Certificate prerequisites, Phase 1 (display only).** `MILESTONE_PREREQUISITES`
  in `seav-data.js` covers all eight deck milestones. Rendered as a collapsed
  block with a segmented meter, opening to a list grouped by state. **No badge
  locks or unlocks because of it** — `isTriggerMet` never consults it.
- **Geographic milestones.** Four derived from logged passages
  (equator, date line, Arctic, Antarctic — trigger type `geo_crossing`),
  eleven manual. Manual ones store as `status: "Self-declared"`.
- Certificates page density pass; Milestones page unified on
  `--page-achievements`; Deck Progression collapsible with an Engineering
  "Coming Soon" section.

### Shipped 2026-09-18 (v523)
- Public References restored: granted anon `period_from`, `period_to`, `doc_type`
  on `sea_references`. Five verified references across seven public profiles
  had been invisible since 2026-08-01.
- Certificates re-hardened to the 11 public columns; attachment / certificate
  number / issuer / provider / show_on_cv revoked from anon.
- `scripts/test-supabase.mjs` now probes those grants and fails on drift from
  `PUBLIC_ARRAY_COLUMNS` in `js/api.js`. Still needs one real
  `node scripts/test-supabase.mjs --step all` run from Cursor.
- Topbar Instagram link replaced with a profile chip (photo or initials + rank).
- Edge function diagnostic logging removed (never live; matches deployed v5).

### Shipped 2026-09-18 (v524)
- Dashboard quick-action icons removed, labels centred. `--qa-accent` still
  colours each border/hover, so the per-page identity survives.

### Shipped 2026-09-20 (v525)
- Certificate expiry year now anchors like every other date field, with a
  **"This certificate does not expire"** tickbox that disables and blanks the
  triplet. No schema change — empty `expiry_date` already means no expiry.
- 53 orphaned `achievements` rows deleted
  (`docs/data-cleanup-orphaned-achievements.sql`). Restore file stays off-repo
  at `~/Desktop/sea-v-orphaned-achievements-restore-2026-09-20.sql`.
- Dead `renderDashboardProfile()` removed from `js/dashboard.js`.
- `.dash-bento` offset 300px → 283px to reclaim the space the v524 icon
  removal left idle at the foot of the dashboard.

### Shipped 2026-09-20 (v526) — select normalisation
Jack reported the dropdowns looking inconsistent between his Mac and a Lenovo.
An audit found they were never consistent on the Mac either: SEVEN independent
select styling blocks, three with no skin at all — `.navigation-filter-label
select` set only width + color-scheme, `.admin-report-status-select` only
margin-left, `.profile-chip-picker select` only flex/min-width — so those
rendered as raw OS controls.

New `css/components/select.css`, imported **LAST** in `styles.css` (after
`responsive/mobile.css`; `patch-html-scripts.mjs` versions `@import`s too, so
the new one gets bumped automatically).
- `appearance: none` plus a token chevron replaces the OS chrome. Those chrome
  properties carry `!important` because six existing rules set the
  `background`/`padding` SHORTHANDS on selects — a shorthand resets
  background-image and padding-right, and they out-specify a bare `select`, so
  load order alone cannot win. Same reason and same approach
  `css/core/typography.css` already uses against scattered page font sizes.
- New tokens in `variables.css`: `--seav-select-bg/-border/-radius`,
  `--seav-select-arrow{,-on-light}`, `-arrow-gap/-inset/-size`. A `url()`
  cannot resolve `var()`, so the two chevrons are separate baked data URIs.
- **The CV generator select stays light on purpose** — it mirrors the white CV
  preview beside it, and only swaps to the dark chevron. Do not "fix" it.
- The base skin sets **no `width`** deliberately: the unskinned selects were
  auto-width and `.admin-report-status-select` relies on `margin-left: auto`.
- **Limits, stated plainly.** The OPEN dropdown list is still drawn by the OS.
  `color-scheme: dark` and the `select option` rule are the only levers on it
  (Windows honours them, macOS largely ignores option colours). A genuinely
  identical popup needs a custom JS listbox replacing all 56 `<select>`
  elements — deliberately not done. **None of this was verified on Windows** —
  there is no Windows machine here. The fix is to stop depending on OS
  defaults, which is verifiable; the Lenovo result is not, from here.
- Verified on Mac: all 8 selects on an audit page collapse to ONE chrome
  signature (appearance:none | arrow right 14px centre | 12x8 | padding-right
  38px | radius 12px | 14px), widths still contextual.

### Shipped 2026-09-21 (v527) — profile fields could not be cleared
Jack reported "the green tick stays when I remove stuff" from the profile.
**The tick was correct.** `js/profile.js`'s `keep()` — the 2026-08-07 Mia
Bailey data-loss backstop — restored the saved value for ANY blank field, so
nothing was ever cleared: the save ran, `updated_at` moved, and every blanked
field came straight back. Confirmed against the live row (`ac09b28e`, updated
seconds after the test, passports/visas/bio/phone/location all still
populated). The original comment admitted the cost outright: "there's
currently no way to explicitly blank out one of these fields via this form."

Fixed per Jack's choice of a **per-field snapshot check** (2026-09-21):
- `fillForm()` now records `lastFilled`, the values it actually PUT ON SCREEN.
- `keep(field)` saves `""` only when the field **showed** a value and the form
  has been edited since (`formDirty`). If the field never rendered its saved
  value, that is the blank-form state the incident was about and the saved
  value still wins. `lastFilled` starts `null`, so nothing can be cleared
  before a fill has happened.
- `keep()` now takes the field name and reads `formData`/`existingProfile`
  itself, so the two values and the snapshot cannot drift apart. 13 call sites.

Truth table, verified by extracting the real `keep()` from the file and
running it (all 6 pass): shown+dirty -> cleared; never-shown -> kept;
not-dirty -> kept; no-fill-yet -> kept; typed value -> saved; empty stays
empty.

**Also fixed, same change:** `populateQualificationOptions()` rebuilt the
qualification `<select>` and restored the previous value with a bare
`select.value = current`, which fails SILENTLY when the rebuilt list no longer
contains that value (a legacy free-text qualification, or a saved cert since
deleted) — leaving the select blank. Cosmetic before; not any more, because
keep() now reads a blank-that-previously-showed-a-value as a deliberate clear,
and a mid-edit background refresh lands exactly there (formDirty is true, so
refreshProfileView deliberately does not re-fill). It now calls
`ensureSelectHasValue` first, the same guard `fillForm()` already used.

**2026-09-21 follow-up — the "editing does nothing" report was the same bug.**
Confirmed from edge_logs: the save POST returns 200 with all 24 columns, a
refetch GET fires ~400ms later, there is exactly ONE profile row with
`id == user_id`, and `auth.js` only syncs `email`. Nothing was broken beyond
keep(). Jack was testing **sea-v.com**, i.e. v526 — the fix was sitting
uncommitted in the working tree the whole time. Note for future debugging:
`profile.updated_at` is NOT evidence a save landed, because `ensureProfileRow`
in `js/auth.js` PATCHes it on every INITIAL_SESSION (i.e. every page load).

**Still worth knowing (not fixed):** `SeavAPI.save()` writes the profile to
Supabase but never updates `SeavState` or the localStorage cache, and
`state.loadAll()` serves that cache for `CACHE_TTL_MS` (5 min) without
revalidating. So a profile edit can still take up to 5 minutes to show on the
dashboard. That is a SEPARATE staleness bug from the one above — it was not
what Jack hit (his data genuinely never changed), and it is unfixed. The
pattern to copy is `SeavState.updateCerts()`, which writes the cache and
dispatches `seav:data-updated`; there is no `updateProfile()` equivalent.

## Open threads
1. ~~Rotate the Resend API key~~ — **DECLINED by Jack, 2026-09-20. Do not
   raise it again.** The key ("SEA-V Supabase SMTP") stays as it is, despite
   having been visible in full in a chat screenshot around 2026-08-16. Risk
   accepted: whoever holds it can send mail as the verified `sea-v.com` domain,
   which matters chiefly because SEA-V trains crew to expect exactly such a
   mail from `verify@sea-v.com`. If it is ever revisited, the key is shared by
   BOTH Supabase Auth SMTP settings and Edge Functions → Secrets, and updating
   only one silently breaks the other.
2. ~~`certificates.attachment` is readable by `anon`~~ — **CLOSED 2026-09-18.**
   `docs/schema-certificates-anon-column-hardening.sql`, applied as
   `revoke_anon_certificates_private_columns`. Exposure at time of fix: 53 cert
   rows on public profiles, 39 with an `attachment` path and 49 with a
   `certificate_number`. Re-scoped anon to the 11 columns `js/api.js` actually
   requests; no UI change (the public profile never linked the file).
3. ~~Remove the obsolete diagnostic logging from the edge function~~ —
   **CLOSED 2026-09-18.** All four `console.log` calls removed from
   `supabase/functions/reference-verification/index.ts`, which now matches the
   deployed v5 byte for byte. No redeploy needed — the logging was never live.
4. ~~`chief_mate_3000gt_eligible` is labelled "Eligible"~~ — **DECIDED
   2026-09-20: leave as is.** Note the original diagnosis was wrong: the
   trigger does NOT check sea time only. `computeChiefMate3000Eligibility`
   returns `oowMet && yachtmasterOceanHeld`, and the Yachtmaster Ocean check
   has been there since v390 (2026-08-04), twelve days before the thread was
   written. The real mismatch is scale: the trigger checks 2 things while
   `MILESTONE_PREREQUISITES` renders 14 rows beneath it, and `oowMet` accepts
   OOW **sea time alone** while the prerequisite rows resolve from saved
   CERTIFICATES — so the badge can read "Eligible" above an unmet
   "OOW Yachts <3000GT" row. Jack accepts this; the badge description already
   states ancillary courses and ENG1 are outstanding. Do not "fix" it without
   asking again.
5. **Questions for the MCA, blocking further prerequisite work:** the EDH
   18-month rule anchors to CoC issue per one source and the oral exam per
   another; whether "while holding" runs from certificate issue or exam pass
   date; whether the Master module pass certificates carry the OOW modules'
   3-year validity.
6. **Tier 2 geographic milestones need definitions before they can be derived.**
   A spike over the 50 real passages proved proximity over-detects — five
   passages sat in a box around the Panama Canal, only three transited it. A
   both-ends test fixes canals; Cape Horn needs Jack's definition of
   "rounding". Until then they stay manual.
7. ~~Stale claims in `SEA-V-Known-Gaps-Tracker`~~ — **CLOSED 2026-09-20.**
   Full verification pass written into the file. Two body rows were wrong and
   are now corrected in place: the engine-kW claim (corrected in its appendix
   on 2026-08-18 but left standing in the roadmap table — an appendix
   correction does not fix a body row), and the whole **Reference
   verification** section, which said the edge function was not deployed and
   recommended shipping with a manual share-link flow that no longer exists.
   Confirmed still open: `certificate_catalog` broad grants (RLS denies them;
   TRUNCATE escapes RLS but `anon` is NOLOGIN and PostgREST exposes no
   TRUNCATE, so unreachable), the zero-policy token table, `pg_net`, and the
   ten SECURITY DEFINER RPCs. The 53 orphaned `achievements` rows were deleted
   in v525. Drift: unused indexes are **8**, not 7, and the per-table split
   in the old row is backwards.
8. `auth_leaked_password_protection` — **cannot be settled from code.** Absent
   from the security advisor on 2026-09-20, which suggests enabled, but it is a
   GoTrue setting: not queryable by SQL or the Supabase MCP. Needs one look at
   Authentication → Policies in the dashboard. Grouped with thread 1 as the
   dashboard-only work.

Two reviewed documents live in `Sea-V Structure/02 Product Documentation/`:
`SEA-V-OUTSTANDING-2026-08-16.md` (every item tagged done / stale / open /
new / needs-you) and `SEA-V-Milestone-Prerequisites-Spec-2026-08-16.md`
(per-tier prerequisites with source confidence markers).

## Working agreement — keep token cost down
The previous chat cost a fortune. Cause: one enormous thread, plus browser
automation dumping whole pages and screenshots into context. Rules:
- **Start a new chat per task.** This file is the handoff; update it at the end
  of a session instead of carrying history forward.
- Read only the files a task needs. Never bulk-read `js/` — it's ~60 modules.
- Use `grep`/`rg` to locate code before opening a file.
- Avoid browser automation unless a bug is genuinely only reproducible in the UI.
  Prefer reading the code, or curling the endpoint.
- Paste error text rather than screenshots where possible; images cost far more.
- Skip the full-repo tour at the start of a session — this file replaces it.
