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
- **`node` IS available — it is just not on PATH.** Corrected 2026-09-21.
  There is no Homebrew, no nvm, no `npm`, and no shell init file on this Mac;
  `node` in a plain terminal fails with "command not found" for Jack too.
  Cursor ships its own:
      /Applications/Cursor.app/Contents/Resources/app/resources/helpers/node
  (v24.18.1, arm64). That is what Cursor's agent uses to run
  `patch-html-scripts.mjs` on every commit. Use the full path here for
  `patch-html-scripts.mjs`, `test-site.mjs` and `test-supabase.mjs`.
  **`npm` does not exist at all**, so `npm run lint` can never work — run
  eslint directly: `<node> node_modules/eslint/bin/eslint.js js/*.js`.
  All three ran clean on 2026-09-21 (lint exit 0; test-site all static +
  HTTP checks passed; test-supabase `--step all` exit 0, including the
  reference/certificate column probes and the 10-table drift check, which
  had never actually executed until then). **The network, however, is NOT the blocker:
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

## Current state (2026-09-26)
- HEAD = **v535**. Jack pushes every commit himself from
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

### Shipped 2026-09-21 (v528) — chips never marked the form dirty
v527 shipped the keep() fix but **removing passport/visa chips still silently
reverted**. Cause: `formDirty` was set only by `form.addEventListener("input")`,
and a chip is added/removed by a BUTTON CLICK, which fires no input event. So
for `passportsHeld`/`visasHeld`, keep() saw a blank it could not attribute to
the person, read it as the blank-form failure mode, and restored the old value.

`addPassportChip`, `removePassportChip`, `addVisaChip` and `removeVisaChip` now
set `formDirty = true`. `setPassportChips`/`setVisaChips` deliberately do NOT —
they are the programmatic fill called by `fillForm()`, and marking them dirty
would disarm the blank-form protection on every load. Verified against the real
`keep()`: blank + existing "British" + shown + dirty=false -> "British" (the
v527 bug); same with dirty=true -> cleared.

**General lesson for this form:** any control that changes state WITHOUT
typing — chips today, any future toggle, drag-reorder or picker — must set
`formDirty` itself, or keep() will quietly undo it. The `input` listener only
covers real inputs, selects and textareas.

### Shipped 2026-09-22 (v529) — instant refresh + the CV tickbox
Jack: "I want the page to reflect instantly what is saved or removed", and
"show on CV generator isn't updating after I untick the cert, it goes back to
blue and shows on the CV". Two separate causes, both fixed.

**1. `.modal-check` defeated the `hidden` attribute.**
`css/components/modals.css` had `.modal-check { display: flex !important }`
with no `[hidden]` guard, and an author `!important` beats the UA's
`[hidden] { display: none }`. So `toggleShowOnCvVisibility()`'s
`wrap.hidden = isMandatory` did **nothing** — the "Display on CV Generator"
box stayed visible and tickable for mandatory certs. Added
`.modal-check[hidden] { display: none !important }`. Any future hidden
`.modal-check` needs that guard; `ct_no_expiry_wrap` is the other one.

**2. The tickbox now governs EVERY cert, mandatory included.**
The untick was saving correctly all along — `show_on_cv` was `false` in the DB
for EFA, PST and FPFF. Two other rules undid it: `cv-engine-model.js` returned
`!!cert.isMandatory || cert.showOnCv !== false` (so mandatory certs were on the
CV regardless), and `toggleShowOnCvVisibility` force-set `checked = true` on
every modal open (hence "goes back to blue"). A control that accepts input,
persists it, then ignores and reverts it is broken however it is framed, so the
mandatory override is gone. `toggleShowOnCvVisibility` is now a named no-op
(kept so the call sites still read as deliberate). The "Not on CV" card flag
dropped its `!cert.isMandatory` condition so it covers those rows too.
Measured on Jack's 22 certs: 22 on the CV before, 19 after — exactly the three
he had unticked. **To restore the old behaviour, put `!!cert.isMandatory ||`
back in `cv-engine-model.js`.**

**3. Profile saves now propagate instantly.**
New `SeavState.updateProfile()` in `js/state.js`, mirroring `updateCerts()`:
merges onto the existing profile (the form does not carry `username` or the
`trb_*` fields, so a wholesale replace would blank them in the cache), writes
the cached snapshot, and dispatches `seav:data-updated`. `saveProfileNow()` in
`js/profile.js` calls it after `SeavAPI.save()`. This closes the 5-minute
staleness noted under v527 — `loadAll()` served the pre-edit cache for
`CACHE_TTL_MS` without revalidating, which made a successful save look failed
and cost two debugging rounds.

**4. Pacific passages.** Navigation unwraps longitudes across the antimeridian
so a Tonga → New Zealand track no longer draws the long way around the world,
and the routing graph now has South Pacific hubs so those island ports can
join a sea lane.

Checklist run: patch-html-scripts updated 26 files, lint exit 0, test-site all
static + HTTP checks passed.

### Shipped 2026-09-26 (v530)
Passages are now a direct great-circle on every leg. The sea-lane graph is no
longer consulted — waypoints already worked that way, and a guessed route
looked more authoritative than it was. A line that crosses land is what
waypoints are for.

### Shipped 2026-09-26 (v531) — full-audit fixes, first batch
A six-area audit (security, DB, front-end data, domain maths, CSS, hygiene)
ran first; the findings not fixed below are thread 9. **Both migrations are
applied live and smoke-tested** as the real `authenticated` role (JWT claims
set, every probe rolled back): attacks refused, normal edit / draft / void /
upsert paths and the full request -> referee-confirm -> Verified flow still
work. Security advisors: same 23 findings before and after, none new.
- **`profile_owner_all` was `user_id OR id`, with no UNIQUE on user_id** — a
  user could move their own row onto another user's `user_id`, set
  `public_enabled`, and make that person's data anon-readable. Now requires
  BOTH, plus `profile_user_id_unique`. Column grants deliberately NOT revoked:
  `SeavAPI.save()` upserts id/user_id on every save.
  `docs/schema-profile-owner-policy-hardening.sql`.
- **Crew could set their own reference `Verified`** with a plain PATCH. New
  trigger `sea_references_verification_guard`: `authenticated`/`anon` may not
  move a row INTO Sent/Verified/Declined, nor change verification/text/date
  while it is in one. The definer RPCs run as `postgres` and are unaffected.
  `docs/schema-sea-references-verification-guard.sql`. **The 3 live
  `Verified` rows (demo-r2/3/4) were set by hand and never verified** — the
  "five verified references" under v523 is wrong. Left untouched.
- `test-supabase.mjs` gained `testOwnerWriteGuards`, which needs
  `SEAV_TEST_EMAIL` / `SEAV_TEST_PASSWORD` for a throwaway account and prints
  SKIPPED without them. **It has never actually run** — no test account here.
- Stored XSS: public-profile map tooltips (Leaflet writes strings as
  innerHTML) now escape port names; the reference signature fallback no
  longer uses an inline `onerror` (escaped text is decoded back into the JS
  string before it runs — never interpolate into an inline handler).
- `.vercelignore` + Netlify 404 rules: `/CLAUDE.md`, `docs/`, `scripts/`,
  `supabase/`, `.cursor/` were all publicly served (200) on sea-v.com.
  **Verify after deploy:** `curl -sI https://www.sea-v.com/CLAUDE.md` -> 404.
- `withSaving({ rethrow: true })` now means "caller reports the error" (no
  toast). Profile form, username, public toggle and navigation pass it —
  they showed success after a failed save.
- "36 Months Onboard" progress bar used the pre-v481 formula; now
  `computeOow36MonthsOnboard`, same as the unlock check.
- New `parseGrossTonnage`: live "2,205 GT" / "1,906 GT" parsed as 2 and 1.
  Length keeps `parseLengthMeters` (a decimal comma is plausible there).
- **CV generator: collapsible settings + fit-to-width preview** (per Jack).
  `#btnToggleCvEditor` folds `.cvgen-editor` to a 30px rail (>1100px only;
  state in localStorage `seav_cvgen_editor_collapsed`). The A4 preview is
  sized with CSS `zoom` via `--cv-preview-zoom` (ResizeObserver, clamped
  0.6-1.6, off at <=900px where the page is already fluid). Print resets
  zoom to 1; the .docx export never reads the DOM. Note it also SHRINKS the
  preview when the panel is open on a laptop (0.76 at 1440px) — before, the
  page sat at 100% and scrolled sideways. Verified on a stubbed copy of the
  page (the real one needs a login); not yet seen with real CV data.

### Shipped 2026-09-26 (v533) — CV template dropdown
Jack: the five stacked template rows should be a dropdown "to look smoother",
with the colour in a circle beside each name. A native `<option>` cannot draw
the circle, so `renderTemplatePicker()` builds a small WAI-ARIA listbox
(trigger button + `role=listbox`, `aria-activedescendant`, arrows / Home /
End / Enter / Escape / Tab). The hidden `#cvTemplateSelect` is still the
single source of truth — the listbox only sets its value and dispatches
`change`. Styled as the editor's light field; its values are now tokens
(`--seav-cv-field-*`, `--seav-cv-menu-*` in variables.css) and the editor's
inputs use them too. `.cvgen-template-menu[hidden]` is guarded explicitly
(the v529 `.modal-check` trap). Verified on a harness loading the real CV
engine: keyboard and mouse selection both switch the preview scheme.

### Shipped 2026-09-26 (v534–v535) — public profile map crossed the date line the long way
v529's antimeridian fix (`unwrapLngs`) lived only in `navigation-map.js`, which
the public profile does not load, so Jack's Nuku'alofa -> Whangarei passage
still drew right round the world there. `unwrapLngs` moved to
`navigation-helpers.js` (loaded by both pages); `navigation-map.js` aliases it
and `paintPublicNavigationChart` now unwraps and draws the same -360/0/+360
copies, with bounds from the centre copy only. Checked on the live public
profile (anon data, local server): the passage is a short line north of NZ.
Any future map that draws passages must use `H.unwrapLngs` too.

### Shipped 2026-09-26 (v535) — passage share card crossed the date line too
The third copy of the bug: `js/seav-share.js` projects onto a flat
2000x1000 SVG, so Nuku'alofa -> Whangarei cropped to the whole world with a
line across it. The track now goes through `unwrapLngs`, is shifted by
+/-360 so its centre sits in [-180, 180], and the from/to markers and
waypoints snap to the copy nearest the track. Because the crop can now run
past x=0 or x=2000, `featurePathInView` draws each land feature on whichever
of three world copies (-2000/0/+2000) intersects the crop, baked into the
one combined land path (still one `<path>` for html2canvas). Land rings that
straddle 180 (Fiji, Chukotka) are unwrapped as well — they used to draw a
stroke across the whole map — except rings that wind round a pole
(Antarctica). The horizontal viewBox clamp now applies only to tracks inside
one world. Verified in a node harness with the real module and the 50m
atlas: Tonga -> Whangarei viewBox 369 wide (was 2000) with Tonga and NZ both
drawn; Suva -> Tonga and Nome -> Provideniya correct; a Mediterranean card
renders pixel-identical to v534. Only navigation.html uses the passage card
(it needs `SeavNavigationMap.loadWorldGeoJson`) and it loads the helpers.

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

9. **Rest of the 2026-09-26 audit, not yet fixed** (roughly by impact):
   storage `*_owner_select` path-planting branch (a user can put another
   user's file path in their own row and read it); no rate limit on the
   verification email (any address, any number of times); background file
   hydration in `state.js` overwrites newer state so deletes reappear;
   Master Unlimited counts pre-certificate sea days (`seav-data.js` ~2027);
   passage can't be unlinked from sea time (mapper omits null `seatime_id`);
   vessel delete orphans linked rows; payslip / specialist-qual delete toasts
   success on failure; payslip total mixes currencies; UTC date parsing
   shifts dates west of UK; `dashboard.html:72-76` duplicate script tags and
   dead `navigation-routing.js` (patch script re-inserts it); CSP allows
   unsafe-inline/eval and whole CDNs, supabase-js unpinned; `navigation_areas`
   / `tenders` have TABLE-level anon SELECT; auth-form focus outlines and
   modal dialog semantics; muted token 4.42:1 contrast. **Needs Jack's call:**
   day counts exclude the end date; overlapping contracts double-count; yard
   uncapped in the dated 36-month path; standby cap is per contract, not
   total; typography.css forces 14px so `--font-label` 11px can never apply.

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
