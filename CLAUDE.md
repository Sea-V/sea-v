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
- HEAD = **v584**. Jack pushes every commit himself from
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


### Shipped 2026-09-27 (v536) — captioned photo evidence on onboard experience
Jack: one photo per entry "takes the entire row up", and employers need a
label and a line on what they are looking at. Decided with him: **up to 4
photos, a label is required on each (caption optional, 80 chars), and the
public profile stays COLLAPSED** ("I don't want the public profile to be
intimidating" — photos are one click away behind Details, flagged by an
"N photos" note in the row). Land-based experience is to reuse the same
component when it is built.
- New column `onboard_experiences.photos` (jsonb array, check <= 4), anon
  granted, in `PUBLIC_ARRAY_COLUMNS` and the test drift list. Applied live and
  smoke-tested (`docs/schema-onboard-experiences-photos.sql`).
- **No data backfill.** `mapOnboardExperienceFromSupabase` presents an old
  image `attachment` as photo 1 (labelled with the entry title) and it moves
  into `photos` on the next save, same storage path. `attachment` is now the
  PDF slot only.
- **`sanitizeFileForStorage` was a whitelist** — it silently dropped any key
  it did not know, so a label would never have saved. It now keeps
  `label`/`caption` only when present; every other file field stores exactly
  what it did before.
- Shared `js/seav-photo-strip.js` (strip + `<dialog>` viewer with arrows and
  Esc) and `css/components/photo-strip.css`, tokens `--seav-photo-*` and
  `--font-caption` in variables.css. Labels/captions are `<strong>`/`<small>`
  because typography.css forces 14px on p/span/label/button. Loaded on
  onboard-experience.html, public-profile.html, and as a `deps` of the
  dashboard's lazy onboard modal.
- Verified on a harness running the real page scripts and stylesheet with
  stubbed data (login needed for the real page): 4-photo strip in one row of
  148px tiles, single photo stays a thumbnail, viewer, label-required block,
  add/remove/edit-caption save, legacy migration, public row, 375px (2 cols,
  no sideways scroll). Not yet seen with real signed Supabase URLs.
- **Known gap:** removing a photo does not delete its file from storage
  (hobbies has the same gap); deleting the whole entry does.


### Shipped 2026-09-27 (v537) — drag-and-drop on every upload field
Jack: "all the document attachments are choose file, can we add the drag
option". `SeavUpload.wireDragDrop` existed but was only wired on the
profile/vessel/tender photo THUMBNAILS, and could not have been reused:
its accept check was mime-only (every ".pdf" drop silently rejected) and it
took one file (multi-photo pickers lost the rest).
- New delegated handler in `js/seav-upload.js` (`enhanceDropZones`): every
  `.profile-photo-field` or `[data-seav-dropzone]` holding a file input gets
  `.seav-dropzone` (dashed outline) and an "or drag a file here" `<small>`
  hint; a drop is handed to the input and a real `change` fires, so each
  page's existing handling runs unchanged. Extensions AND mime patterns
  matched; `multiple` inputs get every accepted file; a rejected type gets a
  toast. Fields with a `.profile-photo-thumb` are skipped (already wired).
- `data-seav-dropzone` added on achievements (native input), hobbies photos,
  onboard photos and the navigation KML/RTZ import. A MutationObserver on
  `<body>` covers the dashboard's lazily injected quick-action modals.
- A file dropped OUTSIDE a zone is now swallowed instead of the browser
  navigating to it and losing an open form.
- Styles in `css/components/forms.css`, tokens `--seav-dropzone-*`; the
  active colour is the one `.profile-photo-thumb.is-drag-over` already used.
- Verified on a harness with the real module + stylesheet and synthetic
  DragEvents: PDF accepted, .docx refused with toast, 2 of 3 files into a
  multi-photo input, stray drop contained, thumb field untouched, injected
  modal enhanced. A real OS drag from Finder has not been tried.

### Shipped 2026-09-28 (v538) — five data bugs from the 2026-09-26 audit
All five are struck from thread 9.
1. **Passage could not be unlinked from sea time.** `mapNavigationAreaToSupabase`
   only sent `seatime_id` when set, so clearing it sent nothing and the row
   kept the old link. Now always sent, `null` when unlinked; the two
   old-database fallbacks in `saveNavigationAreaItem` test for the key, and
   only warn when a real link was dropped.
2. **Deletes said "success" when they failed — and could lose files.**
   `deleteItemById` swallowed errors (toast, then normal return), so payslips
   and specialist quals showed "Deleted" right after "Delete failed". New
   `{ throwOnError: true }` lets them skip it. `deleteSupabaseItem` now asks
   for the deleted rows back (`.select("id")`): an RLS-refused delete is not a
   PostgREST error, it just matches nothing, and used to count as success. A
   row we could see but failed to remove now throws; one already gone does
   not (the achievements engine deletes in parallel). **Storage files are now
   removed AFTER the row** — they used to go first, so a failed delete left a
   record pointing at deleted files. Verified live: other-user delete removes
   0 rows with no error, owner removes 1 (rolled back).
3. **Vessel / sea time delete left dangling links.** Five links already had
   `ON DELETE SET NULL`; `onboard_experiences.vessel_id`, `payslips.vessel_id`
   and `navigation_areas.seatime_id` had no FK at all. Added the same rule
   (`docs/schema-vessel-seatime-link-fks.sql`, applied and smoke-tested; one
   already-dangling payslip link cleared, restore line in the file). Records
   are KEPT and unlinked, never deleted. `unlinkCachedChildren` in `js/api.js`
   mirrors it in `SeavState` so pages don't show the dead link until reload.
4. **Deleted records reappeared.** `hydrateStoredFilesInBackground` snapshotted
   a list, signed its file URLs for seconds, then wrote the SNAPSHOT back over
   the live list — undoing any delete/add/edit made meanwhile, and persisting
   it to the cache. Now merges: a record still present and unchanged (same
   object) gets its signed copy, everything else is left alone. Same fix for
   the profile photo. Reproduced and verified by running the real state.js in
   node: before `[A,B,C]` (B deleted, D added, C edited — all undone), after
   `[A,C,D]` with C's edit kept and A signed.
5. **Dates a day early west of the UK.** `new Date("2025-03-01")` is UTC
   midnight = 28 Feb in PDT (Jack was on PDT, UTC-7, when fixed). New
   `SeavData.parseDateOnly` reads YYYY-MM-DD as the local calendar day. Used
   for display (`formatDatePretty`, CV dates, public expiry, referee page),
   **cert expiry** (expired a day early), **payslip tax year/month** (6 April
   fell into the previous tax year) and the calendar-month "time onboard"
   durations (could drop a month). Verified under TZ=America/Los_Angeles
   (all four wrong before, right after) and TZ=Europe/London (identical).
   **Sea-time day counts deliberately untouched** — `daysBetweenDates` et al.
   subtract and round, so they are already timezone-independent, and how
   days count is still on the needs-Jack's-call list.


### Shipped 2026-09-28 (v539) — green-crew redesign, step 1: lighter + contrast
Jack wants the site minimal and friendly for green crew, with the depth
hidden until needed, and felt the colour was "getting a bit dark". Agreed
plan, one testable step at a time: **(1) lighter palette + contrast**,
(1b) remove a layer of box-in-box borders, (2) a menu that grows with the
user (5 core items, the rest appear once they hold data, plus "Show all
tools"), (3) dashboard as a to-do: CV-ready meter, one "next step" card,
hide zero KPI tiles, (4) first-run setup (role -> basics -> first boat) and
shorter forms behind "More details". Jack said "do what you think will look
better" on the open choices: ocean background keeps its motion (he asked for
visible drift before) with a lighter overlay; page accent colours stay as
the ONE thin shell border per page (they were already low-alpha); the CV
generator's white A4 preview is untouched.
- Tokens lifted (variables.css, old values in its comment): shell
  `#0e1c2e` -> `#182c45`, panel `#132238` -> `#1f3552`, translucent 0.85 ->
  `rgba(24,44,69,0.9)`, `--surface-bg*` and `--navy-900/800` likewise. Every
  page shell already read the token, so this reached all of them.
- App ocean overlay (`body.app-page::after`, layout.css) re-tinted to the
  new navy and eased off.
- `--seav-meta-muted-color` 0.45 (4.4:1, failed AA) -> 0.64 (5.8:1 on the
  lightest card); `--seav-note-color` 0.60 -> 0.66. **98 hardcoded
  `color: rgba(255,255,255,0.42-0.58)` in 21 files now use the token.**
  Skipped on purpose: `::placeholder`/disabled selectors (must stay fainter
  than real values) and the 13 below 0.42 (decorative/disabled — not
  reviewed individually yet).
- Seen on the public profile (local server, live anon data) and the onboard
  harness. Remaining noise is NESTING — at 800px the public profile shows
  four stacked border lines each side (shell > section > vessel card > inner
  card). That is step 1b.


### Shipped 2026-09-28 (v540) — mobile dashboard fixes from Jack's screenshots
Jack sent three iPhone screenshots of the live v539 dashboard. Fixed:
- **Grid 40px in from the quick actions, tiles squeezed.** `.dashboard-shell-section`
  kept its desktop 28px padding on phones, on top of `.dash-bento`'s own
  14px. Now 0 at <=900px; bento sides 14px at every phone width, matching
  the quick actions (measured: both 37px -> 353px at 390px wide).
- **Numbers clipped** ("1,313", "26", "22"). `.dash-tile-num` is nowrap in an
  overflow:hidden tile and could flex-shrink. Now `flex-shrink: 0`, label
  `min-width: 0` so it wraps instead, and the tile icon is hidden at
  <=480px (95px is not enough for icon + "Certificates" + "22").
- **Current-vessel text unreadable over a bright photo.** On <=900px the
  tile stacks: photo on top (150px, 130px at <=420px), text on a solid
  `--page-shell-panel` panel below, scrim hidden. No scrim strong enough to
  work on an overcast sky left much photo visible. Desktop unchanged.
- **Version badge floating over cards.** `position: static` below 760px
  (it is appended last to body, so it lands under the footer). Its lines are
  now `<small>` — as `<span>` typography.css forced them to 14px, which is
  why the "10px" badge looked large everywhere, desktop included.
Verified on a harness with the real dashboard.html markup + stylesheet at
390x844 (no clipping, no sideways scroll) and 1440x900 (desktop unchanged).
Still on the step-3 list from those screenshots: the header block (icon +
title + 3-line description) takes ~40% of the first phone screen, and the
four quick-action buttons differ in height and border colour.



### Shipped 2026-09-29 (v541) — sign-in form shoved left on narrow screens (v540 regression)
Jack's screenshot: on a narrow window the login form sat against the left
edge with "v540 © 2026 SEA-V" beside it. v540 made `.seav-version-badge`
`position: static` below 760px for EVERY page, but `index.html`/`signup.html`
(and the other landing/info pages) lay `<body>` out as a flex ROW, so the
in-flow badge became a second column (85px) and pushed `.container` to x=0.
The static rule is now scoped to `:is(body.app-page, body.public-profile-page)`
(block-layout bodies, where the badge lands under the footer); every other
page keeps the fixed corner badge it always had. Verified locally at 573px
and 375px: sign-in form 38px/38px, sign-up 8px/8px, badge fixed; public
profile badge still static, no sideways scroll. **Lesson: a rule that moves an
element into the flow must be checked on every body layout, not just the
page it was written for.**


### Shipped 2026-09-29 (v542) — new public-profile top, behind `?look=new`
Jack's approved canvas "Step 3", built for real. **Preview only:**
`/u/<username>?look=new` (js/public-profile.js adds `body.pp-look-new` before
anything renders). Without the flag the page is unchanged — measured: all
section boxes identical to the pixel at 1280px, topbar still shown.
- `.pp-wave` (after `.ocean`/`.overlay`): real `img/ocean.jpg`, no filter,
  mask-faded, tokens `--pp-wave-*`. `body.pp-look-new { position: relative }`
  is REQUIRED — body is this page's scroll container, and without it the
  absolute wave anchored to the viewport and stayed put while scrolling.
- `.pp-hero` inside `.public-profile-main` (shares the card's left edge):
  logo | Share profile (`.btn-ghost2`) + Download CV (`.btn-blue` — Jack
  asked for the page's own blue with white text, which is exactly that
  class); then "PUBLIC PROFILE" / `rank · current vessel`
  (`SeavData.getCurrentVessel`) / availability, location, nationality chips,
  all via textContent. Old topbar + `#ppContent > .dashboard-shell-head`
  hidden under the flag. Phone (<=560px): Share becomes a 44px icon button.
- Text uses `<strong>`/`<small>` (typography.css forces 14px on span/button).
  `.pp-hero-actions[hidden]` / `.pp-hero-copy[hidden]` guarded (display:flex
  would beat the UA `[hidden]`).
- **Share profile** works: `navigator.share`, else clipboard + toast; the
  shared URL drops the `look` param.
- **Download CV is a placeholder toast** ("CV downloads are coming"). A CV
  built from PUBLIC data would be wrong: anon cannot read
  `certificates.show_on_cv` (unticked certs would reappear) and contact
  details are private. The real feature = crew publish a CV (not built).
- To make it the default once Jack signs off: add `pp-look-new` to
  `<body class>` in public-profile.html (or drop the flag check), then delete
  the old topbar markup and the flag.
Verified locally with live anon data at 1280 and 390 (Download CV toast,
share icon on phone, no sideways scroll, wave scrolls with the page).

### Shipped 2026-09-29 (v543) — card depth ladder, preview only
Jack: the cards "get darker when opening … deepest blue outer, and lighter
as we go into detail". Under `body.pp-look-new` only: shell
`--pp-depth-0` (the old vessel-card deep navy) -> section cards `-1`
(`--page-shell-bg`) -> first-level boxes (vessel row, KPI tiles, info
boxes, cert rows) `-2` (`--page-shell-panel`) -> opened vessel + linked
groups `-3` (`--navy-800`) -> overview / experience / tender / trophy cards
`-4` (#2b4568, the one new value; #5bbcff labels 4.8:1 on it). Borders
untouched; the vessel photo well stays dark. `.kpi-box` needs `!important`
(pills.css paints it with one). Rendered locally for Jack at 1280px.
**Same change, LIVE already (DB):** onboard experience and self-declared
awards never reached anonymous visitors — the anon policies required
`Signed Off` / `Verified`, while the page code was written to show every
entry (2026-08-09) and Self-declared awards. Jack signed in sees his own
rows via the owner policy, which hid the gap from him. His call: onboard =
everything except Draft; awards = Verified + Self-declared, the latter
tagged "Self-declared" on the tile (`buildAwardTile(..., { markSelfDeclared })`,
public profile only). `docs/schema-public-read-onboard-and-self-declared.sql`,
applied + smoke-tested; `testPublicStatusGates` added to test-supabase.
Reach: jack-sorrell +2 onboard +6 awards, simon-lindstrom +8 awards.
**v544 — ladder steps widened.** Jack pushed v543 and saw "nothing has
changed at all": the existing adjacent shades are ~7 RGB units apart, which
reads as identical. Now d0 rgba(6,15,27,.95) / d1 #0e1d31 / d2 #182c45 /
d3 #22395a / d4 #2b4568 — the inner end is capped by #5bbcff label contrast,
so the range comes from darkening the outside. Lesson: compare before/after
screenshots side by side before calling a colour change done.
**v545 — the new public profile is the DEFAULT** (Jack: "this look
perfect", 2026-09-29). `pp-look-new` is now on `<body>` in
public-profile.html; the `?look=new` JS flag is deleted (old links still
work; Share strips the param). The old topbar markup is deleted — its About
/ Privacy links moved to a quiet `.public-profile-footer-links` row, since
it was the page's only privacy link. `getSectionNavOffset` already coped
with a missing topbar. Checked on the plain URL at 1280 and 390 (no
sideways scroll, share icon 44px). **Gotcha that cost a round trip:** Jack
compared the live site against the static design-canvas board ("M/Y
Senses", dark-text Download CV) and concluded nothing had deployed — ask
which URL is on screen before chasing a cache.
**v546 — no back shell.** Jack: "remove the darkest shell at the back and
leave the other ones floating". `#ppShell` is transparent with no border or
shadow under `pp-look-new`; `--pp-depth-0` retired. The section cards
already had their own 12px gaps, 30px radius, border and shadow, so they
float on the ocean unchanged. Only the footer text sits directly on the
ocean — checked, it reads. 390px: cards 29px from each edge (in line with the hero), no sideways
scroll.
**v547 — five levels, one colour each.** Jack: with the shell gone the
dark "shifted to the next shell in"; brighten the floating cards, and
"all the next boxes in need to be the same color, and so on". Ladder is
now `--pp-depth-1..5` = `--page-shell-panel` (#1f3552, the private pages'
card colour — Jack 2026-09-30: big cards "still too dark", use a private
shade slightly darker than the first box within) / #22395a / #253d5d /
#284163 / #2b4568 (ends at the AA cap for #5bbcff labels, 4.68:1, so the
inner steps are small and the borders do more of the separating). Every translucent white
wash inside the cards is replaced (info boxes, bio, onboard rows,
GT/Length tiles, spec tiles, tender info cells); `.vessel-specs-toggle` is
transparent so its tiles sit at level 5 with their neighbours. All ladder
rules carry `!important` (pills.css + the #ppCareerOverview id selector
beat them otherwise). Measured with every <details> open: exactly one
background per level. Photo wells, pills and buttons are not on the ladder.
Also in v548: the crew name on the profile card (`#pp_name`) was 14px —
typography.css pins every card h3 to `--font-body` with !important. Now
`--pp-profile-name-size` clamp(20px, 2.2vw, 24px), weight 800, one step
under the hero headline (Jack: "too small ... fit the space").
(Jack committed the ladder as v547 and the name as v548.)
**v549 — Career snapshot, "sharp ... simple"** (Jack, 2026-09-30). Four
fixed tiles, each hidden at zero: Miles navigated / **Actual sea time**
(sum of `actualSeaServiceDays`, "2.2 yrs", days under a year) / Yachts /
Countries (distinct from/to countries across passages). Onboard tasks and
Verified refs dropped. **Sea time on the public profile reverses part of
the 2026-08-09 private-only call, at Jack's request** — only the one
total; anon could already read the rows (Milestones progress uses them),
so nothing new is exposed and no grant changed. Strip is
`repeat(auto-fit, minmax(--pp-kpi-min 140px, 1fr))` with nowrap numbers:
4 across at laptop width, 2x2 on a phone. Jack's live values: 54,948 NM,
2.2 yrs (802 actual days, 638 verified), 7 yachts, 19 countries.
**v550** — then "boxes have too much space ... jazz it up": each tile is a head row
(section icon badge from `SeavIcons` — navigation / seatime / vessels, plus
a local globe for countries — and the blue label) over the figure, whose
unit is split off small ("54,948" + `<small>NM</small>`). The section's
`--page-*` colour goes on the icon and a 3px left edge only (labels stay
blue per field-label-typography.mdc). Padding 12px 14px; tokens
`--pp-snap-icon-box/-icon-size/-edge`. Icon-beside-figure was tried first
and does not fit four across the 713px card. 1280: 4 x 201px; 390: 2x2.
**v551 — frosted glass** (Jack, 2026-09-30: the page "looks bland ... it's
missing some white"; three palettes rendered on the live page as an
injected style layer — crisp white / frosted glass / two-tone — and he
picked glass; I had recommended two-tone). Same five `--pp-depth-*` levels,
new values: L1 section cards `rgba(255,255,255,.10)` + `backdrop-filter:
blur(14px) saturate(1.2)`, white glass edge `.28`, soft shadow + inset
highlight (`--pp-glass-*`); L2 `rgba(8,20,36,.55)` and L3 `.45` smoked
glass (keeps label/value contrast); L4/L5 white washes `.07`/`.06`. Every
inner box shares one `--pp-glass-line` (.16) border. **The per-section
page-accent borders on the cards are gone** — replaced by the glass edge,
as in the preview he chose. `@supports not (backdrop-filter)` falls back
to solid `--pp-depth-1-solid`. The Career snapshot edge rule needed
`#ppShell` added: the glass-line `:is()` list carries a two-class selector
and outranked it.
**v552 — the same glass on every private page** (Jack: "lets review the
private pages and do the same"). One place: typography.css UNIFIED SHELL
SURFACES. `body.app-page [class$="-shell-card"]` = `--seav-glass-card` +
blur + shadow (border untouched — each page keeps its v539 accent border);
the `:where(...)` card list = `--seav-glass-panel` (was solid
`--page-shell-panel`). New generic `--seav-glass-*` tokens; the public
`--pp-*` glass tokens now alias them. Not touched: sidebar, topbar, modals,
the dashboard current-vessel tile (needs its solid panel over photos), and
any page rule that paints an inner box with !important (e.g.
seatime.css `.seatime-shell-card .kpi-box`). **Unverified until Jack signs
in to the browser pane** — private pages redirect to login.
**v553 — the public profile's LEVELS on every private page.** v552 went
live and Jack: "you've changed it all to frosted glass ... the boxes etc
get darker, use the public profile as an example". Measured signed in (Jack
signed in to the browser pane; 13 pages, every <details> open): v552's
`:where()` list lost to page CSS, so each page mixed solid navy (every KPI
box, dashboard tiles, `.seatime-table-wrap`), smoked glass and pale white
washes at the SAME level. New block in typography.css after UNIFIED SHELL
SURFACES: level 2 (boxes directly in the shell) `--seav-glass-panel`,
level 3 (what opens inside) `--seav-glass-panel-deep`, level 4
`--seav-glass-wash`, level 5 `--seav-glass-wash-soft`, all `!important`,
class lists taken from the measurement. Re-measured with the rules
overlaid on the live pages: exactly one background per level on all 13.
Left alone on purpose: tinted highlights (nav highlight stat, next
milestone, boundary notes, map hint, waypoint drop zone), buttons, pills,
photo wells, modals, the CV's white A4, page accent borders. A page whose
content only renders with data Jack has none of (e.g. payslip rows inside
a closed year group) was not measured — check new pages/boxes against
this list when they appear.
**v554 — glass sidebar** (Jack: "review the sidebar also as it needs to
match"). `.dash-sidebar` was solid `--page-shell-bg-translucent` with pale
white-wash links — inverted against the glass shells. Now (typography.css,
glass block): sidebar = `--seav-glass-card` + blur + `--seav-glass-edge` +
shadow (solid fallback); links `--seav-glass-panel`, hover
`--seav-glass-panel-deep`, current page `--seav-glass-active` (new token,
white .14) keeping its currentColor accent border, disabled roadmap items
panel-deep. Fills/edges only — layout, mobile row layout, hover nudge
untouched. Verified overlaid on the live dashboard (signed in). Gotcha:
`.dash-link` has a 0.18s background transition, so a getComputedStyle read
in the same tick as the style change returns the OLD colour. Topbar not
touched yet.
**v555 — title band** (Jack: the title area above each page's divider
should "section the same as the first deeper color frosting"). Every
private shell's first child is a `*-shell-head` (measured on all 13;
admin has no shell). One rule: `body.app-page [class$="-shell-card"] >
[class$="-shell-head"]` = `--seav-glass-panel`. Shells are overflow:hidden
with a 30px radius, so the band follows the rounded top with no radius of
its own; the divider line under it is unchanged.
**v556 — context topbar + Search** (Jack picked it from rendered options
on the live dashboard, 2026-09-30). App topbar only (`.public-topbar` keeps
the old bar): soft dark fade `--seav-topbar-fade` + blur, no border, the
logo gradient as one glowing 2px hairline (`::after`,
`--seav-topbar-line*`); links left as plain text; logo centred; right =
Search button + bell + PHOTO ONLY (the rank label and its span/JS are
removed; the name stays in the link's aria-label). **Search**: button
`#topbarSearchBtn` and Ctrl/⌘+K open a glass panel (`wireTopbarSearch` in
core.js, built lazily, `.seav-search[hidden]` guarded). **v1 searches
PAGES only**, read from the rendered sidebar (so "Coming soon" spans are
skipped and the list always matches the menu); the empty state says record
search is coming. Keyboard: arrows / Enter / Esc, Tab kept in the dialog,
focus returns to the button. **Next step, agreed: design record search
(vessels, certs, passages...) with Jack.** Note: layout.css hides the whole
app topbar below 1000px, so phones have no Search entry point yet.
Verified on a local harness (real styles.css + core.js, no auth).
**v557** — the topbar Search button was smoked glass and Jack found it
"too dark"; now white frosted glass (`--seav-glass-card` + blur +
`--seav-glass-edge`), hover `--seav-glass-active` + new
`--seav-glass-edge-strong`. The panel's search box is now white glass too.
**Also v557 — record search** (Jack: "build the search function").
New `js/seav-search.js` (patch-html-scripts inserts it after core.js on
every `data-topbar="app"` page — the rule matches `core.js?v=NNN`, a bare
`src="js/core.js"` check silently never matched). `SeavSearch.find(q)`
searches the crew member's OWN records already in `window.SeavState`
(vessels, sea time, certs, passages, tenders, refs, onboard, milestones,
specialist quals, hobbies, payslips) — no new queries; every page loads
the other pages' keys in the background (state.js queueDeferredPageLoads),
and the panel re-renders on `seav:data-updated`. Every query word must
match; ranked title-prefix > word-prefix > title > elsewhere; grouped,
5 per group. Labels use the pages' own helpers (getOnboardCategoryLabel,
getPayslipMonthLabel...). Empty query = Recent (last 5 opened, localStorage
`seav_search_recent`, re-resolved so deleted records drop) + a hint line —
NOT the page list (Jack agreed: it only repeated the sidebar). Pages still
match when typed, capped at 3, as a keyboard shortcut.
**Arrival:** a result opens `<page>?focus=<id>`; seav-search.js finds the
record by the id its edit button already carries (`data-edit-*-id`, plus
data-vessel/cert/ref/ps-id), opens enclosing `<details>`, clicks a nearest
`button[aria-expanded="false"]` for JS collapses (payslip tax years,
onboard groups) and re-finds after the re-render, scrolls, rings it
(`.seav-search-hit`, 2.6s) and strips ?focus. Verified: logic in node with
the real seav-data.js; focus on the LIVE signed-in pages for certificates,
vessels (closed group), navigation, payslips (collapsed year), tenders,
sea time, onboard, milestones; panel on a local harness. References had no
live rows to test.
**v559 — sidebar home band** (Jack: remove "My SEA-V", line the sidebar up
with the page headers, Dashboard + Profile "inside the darker section to
match the pages title section"). `.dash-title` removed from
renderAppSidebar (the aside carries aria-label "My SEA-V"); the first group
is `.dash-nav-group--home`. Desktop only (>=1001px; below that the sidebar
is a horizontal strip, unchanged): smoked-glass band bled to the rounded
top (`--seav-sidebar-radius`, now also used by .dash-sidebar), one divider,
the next group's divider dropped. Page title bands vary 113-180px
(measured), so `syncSidebarHomeBand()` in core.js sets the band's
min-height to the current page's *-shell-head height (ResizeObserver);
the band's natural height is exactly 113px (2 x 44px links, 3px margins,
6px padding) so the shortest head still matches. Verified overlaid on the
live signed-in pages at 1200px: band and title band share top AND divider
on dashboard (102-215), certificates (102-259) and profile (102-282).
**v560 — CV generator tidy-up** (Jack: "tidy it up, then we can work on
it as i have some good ideas"). (1) Editor inputs/textareas move from the
deliberately LIGHT surface to dark glass: `--seav-cv-field-*` now alias
`--seav-glass-*`; the TEMPLATE PICKER alone keeps the light look via new
`--seav-cv-picker-*` (old values). select.css's `.cvgen-editor select`
on-light chevron rule is removed and its "do not fix" note rewritten — the
light-editor decision of v526/v533 is superseded, with Jack's OK. (2) The
two loose status lines become `.cvgen-status` pills ("Loaded from SEA-V ·
profile, 7 vessels, 19 certs" / "Draft saved · 19:36"). (3) The Career
overview text "looked bigger" — measured: it is 14px like every field
(the 315px test string fills its 322px box exactly); a dense paragraph just
reads heavier. No change. The Hide settings toggle (v531) still works live.
Jack has CV generator ideas queued — ask before redesigning further.
**v561 — the CV generator is the ONE place that decides what goes on the
CV** (Jack's idea, 2026-10-02; his choices: save to the ACCOUNT, remove the
Certificates-page tickbox, new items SHOWN by default).
- **DB, LIVE:** new private table `cv_drafts` (user_id pk -> auth.users on
  delete cascade, `draft` jsonb object <= 200 KB, owner-only RLS, nothing
  granted to anon). `docs/schema-cv-drafts.sql`; smoke-tested as the real
  authenticated role (rolled back) + curl-as-anon 401/42501; advisors
  23/23; `testCvDraftsPrivate` in test-supabase.
- `SeavAPI.fetchCvDraft()/saveCvDraft()` (api.js). NB `runSupabaseWithRetry`
  RETURNS the retry's `{error}` instead of throwing — callers must check.
- cv-generator.js: local save (350ms) + account save (1.2s debounce);
  status pill "Saved to your account · hh:mm" / "Saved on this device only".
  **The account copy wins on load** (no timestamp compare — every load
  re-saves the device copy, so a stale device would always look newer),
  unless the crew member edited before it arrived. No account row yet =
  this device's draft is uploaded (that is the migration). Background
  `seav:data-updated` syncs do NOT count as an edit.
- Model: `draft.choices[group][id]` for certs / specialist / achievements /
  refs / hobbies; `isChosen()` default true (refs: verified only, and an
  unverified ref can never show). First run seeds `choices.certs` from the
  old `show_on_cv=false` (Jack's EFA/PST/FPFF), and certificates.js now
  KEEPS the stored show_on_cv on edit so that seed is never lost. New
  sections switches: showDob, showNationality, showAvailability, showPorts,
  showHobbies. Milestones = every ticked one (was "first 4"); duplicates
  by title show once. **Hobbies & Interests is new on the CV** (preview +
  Word). "Refresh from SEA-V" rebuilds TEXT only and keeps sections/choices.
- UI: 8 collapsible `.cvgen-group`s (Personal info, Yacht experience,
  Certificates, Specialist quals, Milestones & awards, References, Hobbies
  & interests, SEA-V extras) with "x of y" counts, a section switch,
  Select all / none, a tick per item.
- Certificates page: tickbox, "Not on CV" flag and `.cert-cv-flag` removed.
- Verified: engine in node with the real seav-data + CV model/render (seed,
  per-item, refs, hobbies, switches, reset, new-item default); panel on a
  harness of the real page (counts, ticks, select none, section off,
  account save batching, account copy beats device copy). **Not yet seen
  with Jack's live data** until this lands on the live site.
**v562 — one Navigation line** (Jack: the CV "shows navigation three
times"; "it should be the countries from the navigation page"). The
Milestones box used to append "Navigation: <port>, <country>" for the
first four passages. Now `getNavigationCountries` collects both ends of
every passage (`fromCountry` + `country`), once each (lower-cased key,
first spelling kept), A–Z, with a passage count; a new choices group
`countries` + section switch `showNavigation` (replaces v561's
`showPorts`) and a new **Navigation** settings group. The CV gets ONE
"Navigation" sidebar box: the chosen countries comma-joined (preview +
Word). Milestones lists milestones only. Countries default to shown.
Verified in node with the real model/render (merging "Italy"/"italy ",
same-country passage counted once, untick, switch off, one box, no
"Navigation:" lines).
**v563 — public profile certificates grouped** (Jack: "too much to read").
The catalogue's 19 categories split ~20 certs into ~10 tiny groups, so
`renderCertificates` (public-profile-sections.js) folds them into FIVE:
Certificates of Competency / STCW safety & medical / Navigation & radio /
Security / Yachting & other (`PP_CERT_GROUP_BY_CATEGORY` maps each catalogue
label via `SeavData.findCertificateCatalogItem`; custom certs placed by name
keywords). Native <details> per group: title, count, a status pill from the
SAME getCertExpiryInfo the rows use ("All valid" / "N expiring soon" / "N
expired"); the first non-empty group (normally CoC) opens. Group = depth 2,
rows inside depth 3. The old flat list + "Show more" are gone for certs.
Checked locally with live anon data at 1280 and 390 (Jack: 21 public certs
-> 3 / 6 / 4 / 3 / 5, no sideways scroll).
**v564** — Jack: "efficient deckhand is a module for oow 3000". EDH is a
step towards OOW, not a CoC, so the CoC group is licences only (catalogue
"Certificates of Competency — Deck/Engineering") and a new group **Ratings
& CoC modules** follows it: catalogue "Ratings", "Professional examination
modules (MCA yacht)" and "Engineering qualifications" (AEC, MEOL), plus
custom certs matching module/EDH/rating/AEC/exam wording. Six groups now;
Jack's: CoC 2, Ratings & modules 2, STCW 6, Nav 3, Security 3, Other 5.
Also v564 (Jack: "helm o is an oow module"): `PP_CERT_GROUP_BY_CODE` moves
HELM-O and HELM-M (catalogue: Navigation & communications) to the modules
group — single-cert overrides beat the category map. Custom-name fallback
tests module wording BEFORE nav wording ("Navigation and Radar module").
Open question for Jack: ECDIS and GMDSS GOC are also OOW (Yacht)
requirements but stay in Navigation & radio unless he says otherwise.
**Also v549 — onboard experience visible again (DB, LIVE).** The v543
anon rule "every status except Draft" hid every entry written since
2026-08-09: sign-off was dropped then, the form has no status control, and
`mapOnboardExperienceToSupabase` saves `status || "Draft"` — so Draft is
simply the default, not a choice. Jack's 6 Senses entries were all hidden.
New `docs/schema-public-read-onboard-all-statuses.sql` drops the status
condition (owner must still be public_enabled); applied, smoke-tested,
advisors 23/23. **Lesson: before recommending a rule on a status value,
check the form can actually set it.**

### Shipped 2026-10-03 (v565) — sidebar replaced by topbar menus
Jack: sidebar "drop down from the topbar", one column, "just the three
bars"; Public profile / CV generator / Profile settings / Log out on the
photo at top right. Picked from rendered options.
- `renderAppSidebar` + `syncSidebarHomeBand` deleted; `#sidebarMount` is
  set `hidden`, `.dash` is one column (topbar.css). The v554 sidebar glass
  and v558 home band CSS are removed from typography.css.
- Left: round three-bar button `#topbarMenuBtn` (bars <-> X) opens
  `#topbarMenuPanel` = `renderAppNav()` (same groups/links/ids as the old
  sidebar, page-colour icons in tinted badges) + a footer with Contact /
  About / Report / Privacy / Terms. Right: the photo is now a BUTTON
  (`#topbarProfileLink`) opening `#topbarAccountPanel` (`renderAccountMenu`):
  name + "rank · current yacht" header, `#sidebarPublicProfileLink`,
  CV generator, Profile settings, `#btnLogout` — ids kept so
  wireSidebarPublicProfile / wireLogout work unchanged.
- **Every section open** (folding was tried; Jack preferred the full
  column). Then (Jack): section names back to GREY (`--seav-meta-muted-color`
  — the old sidebar's 0.38 white failed contrast), rows 36px ("looks
  squashed"), and the menu is `width: max-content` so it ends just past
  "Specialist Qualifications" (243px). "(Coming Soon)" is its own small
  line so it never sets the width; the footer is `width: 0; min-width:
  100%` so it wraps instead of stretching the menu (it pushed phones
  sideways). Footer drops Contact / About / Report above 1000px (they are
  in the topbar). ~710px tall; scrolls inside on shorter windows.
- `wireTopbarMenus()`: one open at a time, outside click / Esc / link
  click close, Esc returns focus, keyboard open focuses the first link.
- **The app topbar now shows on phones** (layout.css hid it <=1000px):
  quick links hidden, Search icon-only. This is also the phone's Search.
- Gotchas fixed on the way: `.app-topbar .nav-left a` now `> a` (it
  stripped the menu's page colours); layout.css `.nav-right a[href]:not(...)`
  pill rule gained `:not(.topbar-account-item)` (its :not() list outranks
  any plain class); layout.css's <=980px `.dash-nav` sideways strip is
  overridden inside the menu.
- Dashboard gained a 5th quick action, "Build your CV" (the CV generator
  is no longer in the main menu); on phones the odd one spans the row.
- Verified on a local harness (real core.js + styles, stubbed SeavState) at
  1100x820 and 390x844: both menus, Esc, outside click, focus, header,
  public-profile href, no sideways scroll. Not yet seen signed in on the
  live pages. Dead sidebar rules remain in layout.css (`.dash-sidebar*`).

### v568 — watchkeeping no longer double-counted
Simon Lindström's admin report (2026-08-29, still "new"): "Total logged
days" added watchkeeping ON TOP of sea days, though watchkeeping days are
sea days spent on watch. `getSeatimeTotals().total`, `totalQualifyingDays`
(seav-data.js) and the per-vessel totals in public-profile-utils.js now sum
sea + standby + yard only; watchkeeping stays its own KPI. MSN 1858 OOW /
Master maths never used these totals (corrected 2026-08-16) and is
unchanged. Jack's total 1,313 -> 1,197; daniel-whitfield (demo) was out by
1,860. Data oddity left for Jack: Senses 2025-12-12 -> 2026-02-13 has 29
watchkeeping days against 18 sea days. Admin reports are in `bug_reports`
(join profile.user_id for the sender).

### v571 — privacy policy, terms, referee notice (compliance pass)
Jack asked whether SEA-V is exposed to a viral "you'll be sued" list.
Findings: no cookies at all (no `document.cookie`; Supabase auth, the
records cache [sessionStorage], signed URLs, CV draft and small UI prefs
are browser storage, all functional); no trackers/ads/AI; only email is
the transactional referee verification; Sentry error monitoring on 25
pages (EU/de, `userInfo: false`, no HTTP bodies) was NOT in the policy;
site is on Vercel (+ Speed Insights, cookieless). The privacy policy
(29 July) was also WRONG about the public profile: it said tenders and
draft records are never public (both are — v549 onboard all statuses) and
omitted certificates / self-declared achievements.
- privacy.html rewritten in place (same layout): accurate public / never-
  public lists, new "References and referees" section, named providers
  (Supabase London, Vercel, Resend, Sentry EU, CDNs, CARTO/OSM), 72-hour
  ICO breach line, self-service deletion, ICO complaint link, a precise
  "no cookies" storage list, data location. 13 sections.
- terms.html: "Reporting content" notice-and-takedown paragraph; sea-time /
  milestone figures are guidance only, the MCA decides.
- verify-reference.html: footnote telling referees what is saved and what
  may be public (email + CoC never), linking privacy.html#referees. The
  email itself was NOT changed (no edge-function redeploy).
- **Jack to do (not code):** ICO data protection fee; where hero.jpg /
  ocean.jpg / og-share-card.jpg came from; check Sentry's Loader Script
  settings that Session Replay is OFF (the loader's config lives in the
  Sentry dashboard, not the repo).
- **TRADE MARK RISK (found 2026-10-04, Jack's UK IPO search).**
  UK00003451199 word mark "SEAV", owner SEAVIO LIMITED (London), filed
  2019-12-12, registered 2020-03-06, renews 2029. Classes 9/35/36/38/41/42/45,
  incl. "Computer software for tracking and recording professional skills
  and experience", career networking, recruitment, online content hosting,
  social networking — near-identical to SEA-V. Possible angle: 5-year
  non-use (passed 2025-03-06) if SEAVIO is not trading under it. Advised
  Jack: check Companies House + any live SEAV product, then a trade mark
  attorney / British Library IP clinic BEFORE further brand spend; do not
  contact SEAVIO first; EUIPO search too. Not legal advice. Other hits:
  UK00901421452 "seav" logo (SEAV S.R.L., Italy, class 9 hardware — low);
  UK00911501145 dead.
  Checked 2026-10-04: SEAVIO LIMITED (Companies House 12099916) is ACTIVE,
  SIC 62012 software development, files micro accounts (latest to
  2025-07-31, not dormant). seav.io is a parked GoDaddy domain; seav.com is
  the Italian electronics firm. No live SEAV career product found. Jack's
  "SEA-V = sea verification" reading helps aurally/conceptually, not
  visually; services overlap closely. Still: get professional advice.
  Jack, 2026-10-04: SEAV's only trace he found is a 2021 Facebook page
  saying it TRACKS SEA TIME USING AIS — same niche, so confusion risk is
  higher and "sea verification" weaker. But if use stopped in 2021, a
  5-year non-use revocation may be available around now, or the mark may
  be buyable (approach via attorney, not directly). Advised: screenshot
  the Facebook page with dates as evidence, then attorney / IP clinic.
  **Bigger, same day: "Sea-V Pages" (seavpages.com) is LIVE** — same
  spelling incl. hyphen, "the online CV creation tool for superyacht
  crew", CV-as-a-webpage per member + a recruiter service, footer
  "© Sea-V Pages 2026", domain registered 2022-09-01 (sea-v.com shows
  2025-09-09). Operator not named; registrant redacted; link to SEAVIO
  unknown. That is a passing-off risk (earlier goodwill, same customers,
  same product) independent of the registered mark. Jack believes owning
  sea-v.com gives him grounds — told him plainly it does not (a domain
  confers no trade mark/goodwill rights). Advised: priority attorney /
  IP clinic with both findings, keep dated evidence, do not contact
  either party, start a shortlist of alternative names in parallel
  (sea-v.com can redirect). Not legal advice.
  Jack, 2026-10-04: SEA-V is NOT a business and will ALWAYS be free (no
  revenue, ads or paid features planned). Told him: shrinks money claims
  and motive, raises a "course of trade" question for the attorney, but
  free public services usually still count, passing off needs no money,
  and the stop-using-the-name remedy is unchanged. Attorney brief:
  https://claude.ai/artifact/BVKC7XWiXuMEHTJA2YrdSa (private, Jack's).
  **Any new tracker, analytics or marketing email changes the cookie /
  consent answer — update privacy.html section 10 first.**

### Also v571 — sea-time maths checked against MSN 1858 Amendment 1
A code audit (subagent) + live-data check, then the rules read from the MCA
PDF itself (§3.1–3.6, §4.2 definitions, §4.3, §9). Key definitions:
**onboard yacht service = "the time spent signed on a yacht, irrespective
of the vessel activity"** (so signed-on DATES, not the day buckets — Jack
confirmed; a buckets-based 36-month version was tried and reverted);
seagoing = 4h+ working duty in 24h; standby max 14 consecutive days and
total standby never above actual sea; yard max 90 (inside the 115, NOT on
the 36 months); watchkeeping = actual sea service in full charge of a
watch, 4h cumulative = 1 day; month = calendar month or 30 days; §9 = 6
months of the qualifying seagoing service within 5 years of applying.
Changes (seav-data.js unless noted):
- `signedOnDays()` — inclusive (join AND leave day). Used for 36 months
  and every Master onboard figure (apportionment keeps daysBetweenDates).
- `servedAsDeckOfficer()` — Master <500/<3000GT count only deck officer
  roles (capacityServed, else vessel role); trainee/cadet/engineer/bosun/
  interior excluded. Jack's "Trainee 2nd Officer" entries do not count.
- Master <3000GT now also requires **24 months as deck officer on 15m+**
  (§3.6(a)) — was never checked. New progress row + label.
- Master Unlimited actual sea days pro-rated to after the cert date.
- `getEntryVesselGt` falls back to the entry's own GT.
- OOW Sea Time Complete: 4 progress rows incl. "Seagoing days in the last
  5 years"; badge text names §9. Master badge texts corrected (the <3000GT
  one had 12m/500GT and 24m/24m+ swapped).
- "qualifying days" -> "logged days" (seatime groups, dashboard tile,
  vessels). Sea Time form blocks watchkeeping > sea and sea+standby+yard >
  signed-on days.
Verified in node: rule cases pass; old vs new on jack / daniel / simon —
no badge flips (36mo +~1 day/contract; daniel M500 -51 bosun days; Jack
M3000 deck-officer 17.6/24 months).
- **Position dropdowns** (Jack: avoid misspellings). `SEAFARER_POSITIONS`
  (5 groups, 42 roles, each with `deckOfficer` / `master` flags) drives the
  Sea Time "Capacity served" and vessel "Role on vessel" selects via
  `getPositionOptionsHtml` — old free text kept as "(saved earlier)",
  "captain" normalises to "Captain". `servedAsDeckOfficer` / new
  `servedAsMasterRole` read the flags first, regex as fallback.
  `MASTER_CAPACITY_MATCH` now also matches "captain" — Captain entries
  never counted for Master Unlimited before. Picking a vessel on Sea Time
  pre-fills the position from the vessel's role.
- **Yachtmaster (RYA, checked on rya.org.uk 2026-10-04).** DB, LIVE:
  `navigation_areas.passage_role` ('Skipper'|'Watch leader'|'Crew'|null)
  + `ocean_offshore` bool (`docs/schema-navigation-passage-role-ocean.sql`,
  applied + smoke-tested, anon reads them via the table grant, advisors
  23/23, drift list updated). Navigation form: "My role on this passage" +
  "200+ NM more than 50 NM from land" tick; list shows both.
  Jack's calls: **strict RYA "yachts up to 500GT"** for miles AND sea days
  (incl. the existing Sea Miles badge), and **passages with no vessel
  linked count**. Earned badges stay (PERMANENT_ONCE_EARNED_TRIGGERS), so
  daniel / mia keep Sea Miles though their <=500GT miles are 0.
  New: `computeYachtmasterOffshoreChecklist` (10 rows: 50 sea days/10y on
  <=500GT, 25 on <24m, 2,500 NM, 1,250 tidal, 5 passages >60NM, 2
  overnight [arrival date > departure], 2 as skipper, 5 skipper days on
  <24m, SRC/GMDSS, first aid) and `computeYachtmasterOceanPassage` (YMO /
  IYT YMO / OOW held + one passage: 600NM, ocean tick, 4+ nights, skipper
  or watch leader, 10y). Badges `yachtmaster_offshore_ready` (gold) and
  `yachtmaster_ocean_passage` (platinum), art from generate-badges.mjs
  (the generator rewrites EVERY svg with new random gradient ids — revert
  the untouched ones with `git checkout -- img/badges`). "RYA Yachtmaster
  Ocean" sits before Chief Mate in DECK_CERT_GROUP_ORDER. Not tracked:
  tidal sea DAYS, celestial sights, passage times.
  Verified: node rule tests (positions 15/15, Yachtmaster 14/14); Sea Time
  harness — select, vessel pre-fill, legacy value, both form blocks. The
  Navigation form fields were not seen rendered (page needs the map).

### v575–v576 — West Palm Beach port; empty dates open on this year
v575: West Palm Beach added to the USA ports (26.713, -80.047, Lake Worth
Lagoon by the downtown marina). v576 (Jack: editing a passage with no
date "starts back at year and goes from 1950"): new `Seav.fillDateTriplet`
(core.js) = the saved date, or the current-year anchor when there is none.
17 edit forms switched from `setDateTriplet(x, value || "")` (which BLANKS
the year, so the list opens at 1950). Deliberately NOT switched:
certificate expiry (blank = "does not expire", its tickbox relies on
setDateTriplet blanking) and profile date of birth. A year-only triplet
still reads back as "" — no date is invented by the anchor.
Also v576 (Jack: "the land based page doesnt match the other pages"):
its shell was `class="sq-shell-card le-shell"`, and typography.css finds
every page shell with `[class$="-shell-card"]` — an ENDS-WITH match — so
the extra class after it silently dropped the glass card, shadow and title
band. Now `le-shell sq-shell-card`; computed styles measured identical to
Specialist Qualifications (shell, title band, KPI, cards, strip).
**Rule: a page's *-shell-card class must be the LAST class on the element.**

### v577 — public profile: visitors only see sections with content
Jack (2026-10-06): should categories hide when no vessel is added? Agreed:
- **Visitors**: every empty section is `hidden` (vessels, navigation,
  milestones, specialist, certificates, interests; land already was), so
  the section links list only what shows.
- **Owner**: empty sections still render with their "Add ..." button and
  an "Only you can see this" tag (`buildEmptyState`).
- **Bug fixed**: with NO vessels, renderVessels returned before building
  the "Other" card, so unlinked tenders / onboard / refs / achievements
  never showed. They now render as an open "Yacht experience — Not linked
  to a vessel yet" card (`buildUnattachedCard(..., options)`).
- A profile with nothing at all shows visitors one line in `#ppEmptyProfile`:
  "<first name> is just getting started on SEA-V...".
Verified on the local page with live anon data by calling the real render
functions with empty / tender-only data as visitor and owner.

### v578 — modal revamp
Jack approved the mockup. Report an issue stays — it feeds the admin page.
All in the shared layer:
- `css/components/modals.css` REVAMP block: glass card (`--seav-menu-bg`),
  26px radius; header band pinned (sticky) with the accent as a 3px inset
  line; blue normal-case field labels (also on the profile + navigation
  forms, which reuse `.modal-form`); "More details" rows restyled; phones
  <=600px get a bottom sheet. Accent per card = `--modal-accent`, default
  on bare `.modal-card` so the `--gold`/`--coral`/... variants override it
  (a default on the higher-specificity :not() rule made every card blue).
  New `modal-card--land` (land page had no accent). `.email-confirmed-card`
  (index.html) is excluded and unchanged.
- `enhanceModalCard` (core.js, run in initModals + a body MutationObserver
  for the dashboard's lifted modals): section icon in the head
  (`MODAL_ICONS` by modal id), role=dialog/aria-modal/aria-labelledby, and
  a pinned `.modal-foot` = Cancel + the form's own submit / actions row
  MOVED into it (ids and submit handling untouched; Cancel clicks the
  card's X). **Sticky gotcha:** offsets are measured inside the card's
  padding, so the bar needs `bottom: -20px` (-16px on phones) to sit flush.
- Contact / About / Report heads got a subtitle; About is three points +
  Privacy/Terms; Contact links to Report an issue.
Verified on the vessels harness: head and Save bar stay put while the form
scrolls, Cancel closes, submit still belongs to the form, phone sheet at
375px with no sideways scroll, an injected gold modal gets icon + gold
accent + bar. Not yet seen signed in on the live pages.

### v579 — GDPR pass, first batch (2026-10-08)
Jack asked for a UK/EU GDPR check of the site, then "lets start working
through it". The 17-item list (in the chat of 2026-10-08) in short: done
below = 1 storage hole, 6 referee notice, 11 age check, 12 email rate
limit, plus the complaints paragraph (2) and search-engine line (10).
Later the same day: 3 (name), 5 (medical), 7 (export), 9 (retention) done
too — see below. Jack: EU users YES (EU GDPR applies).
**Still open:** postal address for privacy.html (Jack has only a home
address — get a PO box / virtual office BEFORE the ICO fee registration,
which publishes it) (3); ICO fee (4); processor DPAs — Supabase must be
requested, Sentry accepted + Session Replay off (8); record of processing +
breach plan docs (13/14 — DRAFTED, see below); **EU representative under
art. 27** (15 — paid service, Jack to appoint, then name it in
privacy.html); DPIA (16 — drafted, needs Jack's sign-off); leaked-password check (17); inactive-account
deletion automation (needs a warning email; nothing can fall due before
May 2029); API still returns ENG1 dates to anon (page hides them — a DB
view would be the full fix).
- **Storage hole closed, LIVE** (`docs/schema-storage-folder-only-reads.sql`).
  12 `*_owner_select` policies were "own folder OR any path my row points
  at" — plant another member's path in your row and read their payslip.
  5 `*_public_read` policies trusted any PUBLIC profile's row pointing at a
  path. Now folder-only; public reads also require the file to sit in the
  referencing owner's folder (profile_photos already did). Checked first:
  all 159 stored paths sit in their owner's folder, none planted. Smoke
  test as the real roles: plant saved but file unreadable, own files
  visible, anon 16/16 vessel + 20/20 tender photos, 0 private files;
  advisors 23/23; `testPublicStorageReads` added (signs a real public
  vessel photo as anon). Thread 9's path-planting item is struck.
- **Referee email rate limit, LIVE** (`docs/schema-reference-email-rate-limit.sql`):
  `request_reference_verification` refuses past 10/member, 3/reference,
  5/recipient address per rolling 24h. Real use so far: 1 request ever.
  Tested in rolled-back SQL (RPC only — no email from SQL); probe added to
  testOwnerWriteGuards. Thread 9's rate-limit item is struck.
- **Referee notice:** the verification email (HTML + text) now says the
  crew member gave SEA-V the referee's name and email, used only for this
  request, linking privacy.html#referees. Edge function **deployed as v6**
  (was v5); deployed code checked against the repo; OPTIONS 200, unsigned
  POST 401. A real send has NOT been tried — Jack can send one to himself.
- **Age:** sign-up tick now "I am 16 or over, I agree to the Terms of Use,
  and I have read the Privacy Policy" (you don't "agree" to a privacy
  notice); terms.html eligibility says 16+.
- **privacy.html:** complaints paragraph (`#complaints`, DUAA s.164A in
  force 19 June 2026: acknowledge within 30 days), "we reply within one
  month", public profiles may appear in search engines. Dated 8 Oct 2026.
- **Controller named (3):** privacy.html "Who we are" = Jack Sorrell as
  data controller; terms.html section 01 names him as the other party;
  terms' deletion line now points at self-service Delete my account.
- **Medical certificates (5)**, Jack: "eng1 can show but no details".
  `SeavData.isMedicalFitnessCert` (ENG1, STCW ML5, "medical certificate"
  wording — NOT Medical First Aid / Medical Care; 10/10 cases). Public
  profile: `buildCertRow(cert, { hideDates })` = name + "Medical
  certificate · details kept private" + neutral "Held"; excluded from the
  group status pill and the expiry sort. Seen on Jack's live public data.
  **The REST API still returns those dates to anon** (column grants are
  per column, not per row). Upload: `#ct_medical_consent_wrap` tick shown
  only while a NEW file is chosen for a medical cert; save refused without
  it; the stored attachment gets `healthConsentAt` (api-core
  sanitizeFileForStorage whitelists it). Harness-tested: hidden before a
  file, blocked without tick, saved with stamp after; PST / Medical First
  Aid never show it.
- **Download my data (7):** `SeavAuth.exportMyData(onProgress)` in auth.js
  (`USER_EXPORT_TABLES`, 16 tables, own rows via RLS + every file in the
  member's folder of every bucket, JSZip lazy-loaded) -> ZIP with
  sea-v-data.json, files/<bucket>/..., README.txt (counts + anything that
  failed). Button `#btnExportData` on Profile settings above Delete.
  Files go in as ArrayBuffer (JSZip cannot read Blobs outside a browser).
  New `bug_reports_owner_select` so members can read (only) their own
  reports (`docs/schema-bug-reports-owner-read.sql`, applied + tested).
  Verified: node test of the real function, fake client (8/8); all 16
  tables `select *` as the real authenticated role, no column errors.
  NOT tried with a real signed-in session — Jack should click it once.
- **Retention (9)**, Jack: "do what you suggest". pg_cron job
  `seav-retention-cleanup` 03:15 UTC daily -> `run_retention_cleanup()`
  (EXECUTE revoked from anon/authenticated; REST 42501): referee links 90
  days after expiry, declined references 1 year after (only rows with no
  file), bug reports after 2 years. Inactive accounts: in the policy, not
  automated (see open list). `docs/schema-retention-cleanup.sql`; smoke
  test removed each old row, kept each recent one. Nothing was due.
- privacy.html also: retention list, Download my data, medical paragraph +
  explicit-consent basis, EU users may complain to their own authority.
- **Compliance documents** (`docs/compliance/`, never deployed —
  .vercelignore drops docs/ and *.md): `record-of-processing.md` (art. 30),
  `breach-and-requests-procedure.md` (72-hour plan + breach log, rights
  requests, DUAA complaints, lost-2FA-device procedure; the 2026-10-08
  storage hole is logged there as a vulnerability, not a breach — no
  cross-folder path existed), `dpia.md` (screening + 9 risks; awaiting
  Jack's signature). Keep the record current when data, providers or
  retention change.
- **Two-step login (TOTP 2FA), Jack's ask.** DB, LIVE
  (`docs/schema-mfa-enforcement.sql`): `private.mfa_satisfied()` (definer,
  in non-API schema `private` -> no advisor finding) = aal2, or no
  VERIFIED factor; RESTRICTIVE `mfa_required` policy (to authenticated,
  using + with check) on all 17 member tables and storage.objects;
  `delete_own_account` and `request_reference_verification` check it too.
  Smoke test (stand-in factor, rolled back): no 2FA 22 certs; 2FA+aal1 0
  certs / 0 files / delete + insert refused; 2FA+aal2 22 certs / 26 files.
  Advisors 23/23. Front end: auth.js `needsSecondFactor`,
  `verifyLoginCode`, `startTotpSetup` / `confirmTotpSetup` /
  `cancelTotpSetup` / `turnOffTotp`; `enforceRouteAccess` sends an aal1
  session that owes a code back to index.html (`mfaPending` keeps it
  there); index.html `#mfaForm` code step ("Use a different account",
  "Lost your phone?" mailto); Profile settings `#mfaZone` (QR on white,
  manual key, confirm/cancel, turn off; its code input stops input events
  so it never marks the profile form dirty). Harness-tested both screens
  with stubbed SeavAuth (wrong/right code, spaces stripped, every state).
  **Not tried against real Supabase MFA** — Jack must check TOTP is
  enabled (Supabase -> Authentication -> Multi-Factor) and do one real
  enrol + sign-in. No backup codes: lost device = admin removes the factor
  after an identity check (procedure in the breach doc).

### v580 — Schengen Days, cert expiry reminders, sea service testimonials
Jack picked the top three "next level" ideas, 2026-10-08:
  - **Schengen Days** (`schengen.html` / `js/schengen.js` /
    `css/pages/schengen.css`, menu under Career, lime `--page-schengen`).
    Rules in seav-data.js `computeSchengenDays` / `checkSchengenTrip`
    (27/27 node cases): from passages — in a country from arrival to the
    next departure, sea days count only Schengen->Schengen, entry and exit
    days both count; the member's own stays override day by day
    (`profile.schengen_stays`, private, saved by
    `SeavAPI.saveSchengenStays`, never written by the profile form);
    overstay warning only inside the current 180 days; blocks with 30+
    days "assumed in port" are flagged (Jack's 2023 Greece->Italy winter
    showed as a 409-day block). EU/EEA/CH passports exempt (a Schengen
    VISA is not). Monaco / San Marino / Vatican counted. Harness-tested
    with Jack's real passages.
  - **Certificate expiry reminders** — `docs/schema-cert-expiry-reminders.sql`,
    edge function `cert-reminders` (verify_jwt false; Vault token
    `seav_cron_token` checked by service-role-only `verify_cron_token`),
    digest at 90 and 30 days, logged in `cert_reminder_log`, demo
    addresses excluded, opt-out `profile.expiry_reminders` (Profile
    settings `#reminders`). **pg_cron job `seav-cert-reminders` is
    INACTIVE** — switch on when Jack agrees:
    `select cron.alter_job((select jobid from cron.job where jobname='seav-cert-reminders'), active := true);`
    Dry run (`{"dryRun":true}` via pg_net) works; no real email sent yet.
  - **Sea service testimonials** — `docs/schema-sea-service-testimonials.sql`,
    edge function `sea-testimonial` (request / preview / complete, all
    via service-role-only RPCs; member JWT + two-step login checked in the
    function), `verify-testimonial.html` for the captain, `js/seav-testimonial.js`
    on the Sea Time page (Get captain's signature / Send again / Print
    testimonial; status pill). `seatimes.testimonial` + `testimonial_status`
    are private and guarded by trigger (members cannot write them; editing
    a confirmed entry -> "Changed"). MIN 543: the PYA/Nautilus still
    verify for an NoE — every page and the printout say so. Tested live
    end to end on the demo account (then reverted); no real captain email
    sent yet.
  - Also fixed on the way: `land-experience.html` was missing from
    auth.js PROTECTED_PAGES (sign-in from it landed on the dashboard).
- Gotcha: test-site's HTTP checks all 404'd against an old
  `http.server` whose folder had gone — start a fresh server from the repo.

### v581 — Bridge theme on every signed-in page
Jack (2026-10-09): the dashboard "looks too AI"; three looks rendered on a
harness of the real dashboard with his public data (A Bridge — navy,
brass, square; B Logbook — light paper; C Console — graphite). He picked
**Bridge**. New `css/core/theme-bridge.css`, imported LAST in styles.css,
scoped to `body.app-page` (public profile, landing and sign-in pages
unchanged). Mostly a token swap: the v552/v553 glass levels read
`--seav-glass-*`, so those become flat navy surfaces
(#0f2236 / #12283e / #152e47 / #18334f, rule #1f3a56); `--seav-topbar-*`
become a solid bar + one 2px brass (#b8954a) rule; menu / modal / select /
pill / photo radius tokens shrink to 3-6px. Rules on top: (ocean first hidden, later restored — see below)
(`body.app-page::before/::after` hidden), no backdrop blur anywhere, page
shells lose card, border and accent border (title band = one rule), box
lists squared to 4px with no shadow, buttons and status pills squared, page
quote footers and the dashboard green tick hidden; dashboard tiles show the
page colour as a 3px left edge, monochrome icons, small-caps labels, brass
progress bars. Field labels keep #5bbcff. **To revert: delete the one
@import line in styles.css.** Seen on harnesses: dashboard (Jack's data),
Sea Time page and its form.

### v582 — square every corner; Schengen Days removed
Jack, same day as v581: **every rounded corner**
— `scripts/generate-bridge-corners.mjs` reads the app-page stylesheets and
writes all 296 rounded selectors into the GENERATED block of
theme-bridge.css (circles, avatars, toggles, badge-unlock and loaders left
round). **Re-run it after changing any page stylesheet.** Measured 0
rounded elements on dashboard, navigation, certificates, hobbies, land
and in every modal there. Menu icons lost their tinted badge for good
(topbar.css, not the theme); modal head + About point icons likewise (in
the theme). Modal info-box labels are blue in every modal (modals.css;
the old per-accent variants broke the label rule). Search (button + panel) was
still see-through — it used `--seav-glass-card`, which Bridge makes
transparent — so the theme gives it solid surfaces (`--seav-menu-bg` panel,
`--bridge-surface` button/field), a brass outline on the selected result,
and bare result icons. **Anything else styled with `--seav-glass-card`
will look see-through under Bridge — give it a solid surface.**
**Schengen Days REMOVED** (Jack: "its too much") — page, js, css, menu,
search, engine in seav-data.js, privacy line, page lists. Data:
0 of 15 profiles had stays. **`profile.schengen_stays` still exists** (empty,
private): v581 still selected it, so the column was left in place. After
v582 is live, drop it with a new migration and remove the schengen probe
from test-supabase.mjs.

### v583 — Bridge on public info pages; ocean photo back
Jack: "check the public pages also". The theme's
scope widened from `body.app-page` to
`:is(body.app-page, body.landing-page, body.legal-page, body.index-page)` —
About, Privacy, Terms, Contact, sign-in / sign-up, reset, confirm, referee
and captain pages. Ocean/overlay hidden; main panels (`.info-panel`,
`.legal-article`, the auth cards, `.verify-reference-panel`) solid
`--bridge-surface`; inner boxes + form fields `--bridge-surface-2`;
`.legal-callout` = brass left edge; `.legal-topbar-inner` = bar + brass
rule. The corner generator covers those sheets too (320 selectors).
Measured on all 10 pages: no translucent box, no blur, no rounded corner.
**The public profile is deliberately NOT in scope** (its frosted look was
Jack's 2026-09-30 pick) — ask before changing it. Noticed, not changed:
privacy.html's top callout tells visitors to "have it reviewed by a
qualified lawyer" — a drafting note left visible. **Ocean photo restored behind every themed
page** (Jack: "put the ocean photo back, leave the new style ... just
behind") — the rules hiding `body::before/::after` (app pages) and
`.ocean/.overlay` (public pages) are removed; panels stay solid, so the
photo shows only around and between them.

### v584 — topbar matches the menu; title rows are a solid band
Topbar lifted to the dropdown menu's navy (Jack:
"too dark, make it like the sidebar color"): `--bridge-bar` #07111d ->
#0d1e31, and `--seav-menu-bg` now reads `var(--bridge-bar)` so the two
stay identical (also the public pages' `.legal-topbar-inner`). Page title rows
(`*-shell-head`) are a solid `--bridge-bar` band with a hairline border and
4px corners (Jack: "i dont like that its floating") — was transparent with
only a bottom rule.

### v574 — 48 skills & qualities, grouped
Jack: "add more skills that would be relevant to yachting". CREW_QUALITIES
grew 16 -> 48 in five CREW_QUALITY_GROUPS (Working style, Physical &
outdoors, Deck & practical, Guest & hospitality, Tech & admin); the picker
shows the group headings. All 16 original keys kept (values are stored —
never rename/remove one; labels may change). Still max 4 per item (raising
it needs a migration: the DB checks are <= 4). Every crew-facing label is
now "Skills & qualities" (forms, page strip, public profile, CV generator
group, CV / Word heading "Skills & Qualities").

### v575 — West Palm Beach on the navigation port list
USA port added so a passage to/from there can pick the name instead of a
custom pin.

### v572 — the "personal side": interests, qualities, land-based experience
Jack (2026-10-05): not "new crew" framing — "something that allows them to
show a personal side ... hobbies like pictures, achievements within the
hobbies but self declared (ultra marathon completed, hiked Kilimanjaro)"
and "skills and qualities that would cross over with yachting ... working
in a team, hard labour or long hours, heavy lifting". A first mock ("What I
bring", "New to yachting" pill, dashboard card) was REJECTED as singling
people out; v2 (this) approved "i love it, build it".
- **DB, LIVE** (`docs/schema-personal-side-land-experience.sql`, applied +
  smoke-tested, advisors 23/23, test-supabase covers it):
  hobbies_interests + `years` (0-80), `highlights` jsonb [{title,year}]
  <=8, `qualities` jsonb <=4; specialist_qualifications + `qualities`; new
  table `land_experiences` (role, employer, location, date_from/to,
  is_current, description, qualities, attachment) — owner RLS, anon reads
  public_enabled owners, `attachment` (reference letter) NOT granted; new
  private bucket `land-experience-files` with FOLDER-ONLY policies (does
  not copy the older buckets' path-planting branch, thread 9).
- `CREW_QUALITIES` (16 fixed values, seav-data.js) + `normalizeQualities`,
  `normalizeHighlights`, `collectCrewQualities`, `normalizeCategoryValue`
  (fixes categories saved as both "sport_fitness" and "Sport & fitness" —
  applied in the mappers on read).
- New `js/seav-qualities.js` (picker max 4, tags, summary strip,
  renderStateSummary) + `css/components/qualities.css`; tokens
  `--seav-quality-*`, `--seav-highlight-*`, `--pp-interest-*`. Tags are
  <small> (typography.css forces span to 14px).
- Hobbies page: "Years doing it" replaced the start/end date fields (old
  dates kept on save), highlights editor (+ Add a highlight, max 8,
  "Self-declared"), qualities; cards show them; KPI "Highlights"; intro copy
  no longer mentions "just starting out".
- Specialist page: qualities in the form and on cards; Qualities strip.
- **Land-Based Experience page built** (land-experience.html / .js / .css):
  reuses the `.sq-*` structure so the typography.css glass levels apply;
  `.le-shell` swaps the accent to the coral confirmed 2026-08-02
  (`--page-land-experience` #ff7a5c — already existed). Menu item is live
  (was "Coming soon"); search covers land roles; state/api/mappers/
  USER_STORAGE_BUCKETS/test lists all wired (key LAND_EXPERIENCES).
- Public profile: "Qualities" card (counts across published interests,
  quals and land roles; hidden when empty); "Interests & Achievements"
  (renamed) as photo-led cards — up to 3 photos opening the shared viewer,
  years, highlights, qualities; specialist rows show quality tags; new
  "Land-Based Experience" section (hidden for visitors when empty).
- **On the CV too — v573** (Jack: "yeah why not, use the current layout to be able
  to tick to show or not"): new CV generator groups **Land-based
  experience** (switch `showLand` + tick per role) and **Qualities**
  (switch `showQualities` + tick per quality, from `collectCrewQualities`
  over the CV source), plus a "Show highlights under each interest" switch
  (`showHobbyHighlights`) in Hobbies. CHOICE_GROUPS gained "qualities" and
  "land". `doc.hobbies` items are now {title, highlights[]} (render + docx
  still accept plain strings). Preview: sidebar "Qualities" block after
  Other Qualifications, highlights as italic lines under each interest,
  main-column "Land-Based Experience" after Yachting Experience (same job
  layout). Word export mirrors all three. Verified in node (model, render,
  docx via a fake JSZip: 13/13) and on a harness of the real generator.
  Dashboard snippets unchanged.
Verified on harnesses of the real pages (stubbed data): hobbies render +
form (highlight add/remove keeps typing, 5th quality refused, saved
payload), land page (render, current role first, "still work here",
save), public sections at 350px (no overflow after fixing highlight wrap
+ tag size) and 1280px (240px photo column).

### v570 — CV generator guides crew to fill empty sections
Jack: most crew will use the (free) CV generator and need sending to
where the information is added. Every empty settings group now shows a
short line + a button to the page that fills it (Add a vessel /
certificates / specialist qualifications / a reference / hobbies &
interests, Log a passage, See your milestones), same tab — the draft is
saved to the account. Select all / none hide on an empty list. Personal
info lists the profile fields the CV prints that are blank (name, rank,
photo, phone, email, location, date of birth, nationality, availability)
with "Complete your profile". An empty group's count pill turns blue
(`.cvgen-group.is-empty`) so the gap shows with the group closed.
`GROUP_EMPTY` / `VESSEL_ADD` / `PERSONAL_FIELDS` in cv-generator.js.
Verified on a harness of the real page: all 8 prompts + links on an empty
account, and they clear (counts return) once data exists.

### v569 — "Awards" -> "Achievements" (Jack, 2026-10-03)
Every place crew see the word: the per-vessel group on the public profile,
the public Vessels and Milestones notes, the Milestones page heading
("Seafarer Achievements"), the empty-state text in core.js, and the CV
generator group ("Milestones & achievements"). Internal names stay
(`buildAwardTile`, `getAwardTreatment`, `--award-*`, the
`vessel-linked-section-group--awards` class, `achSeafarerAwardsGrid`).

### v568 — SEA addendums (Simon's other admin suggestion)
"Allow multiple files ... so addendums to SEA can be added." The main SEA
stays ONE file (`vessels.sea_attachment`); addendums are a new private list
`vessels.sea_addendums` (jsonb array, check <= 10, no anon grant, not in
PUBLIC_ARRAY_COLUMNS; `docs/schema-vessels-sea-addendums.sql`, applied +
smoke-tested, advisors 23/23, probed by test-supabase). Each file keeps a
`label` (default = file name). In `ENTITY_FILE_FIELDS.vessels` as an
`isArray` field, so signing and whole-vessel delete cleanup come free.
- Form (vessels.html, under the SEA field): a row per addendum = name input
  + file name + Remove; "Add addendum" (multiple, drag-and-drop, PDF / Word
  / images). New files upload on Save (`buildSeaAddendums`); removed saved
  files are deleted from storage AFTER the row saves, via new
  `SeavAPI.removeStoredFiles`. `sea_addendums` had to be added to the
  hand-written vesselData whitelist in the submit handler (same trap as
  contract_type).
- Card: "Addendums" links under View document, by name.
- seav-upload's drop hint now says "files" (not "photos") for a multiple
  input that takes non-images.
- Verified on a harness of the real vessels page (stubbed storage): card
  links, add 2 / remove 1 / rename / save -> 2 uploads, 1 storage delete
  after save, SEA untouched, stored shape has label and no signed url;
  390px no sideways scroll. Not yet tried with real uploads.

### In progress 2026-09-28 — public profile redesign (design stage, NO code yet)
Jack found the public profile "boring and bland". Design canvas (private, Jack's
account): https://claude.ai/artifact/Mw2fZsYB1ZtLCvtb1x3mJq — it opens on
**v3** (`Profile3.dc.html` + `ProfilePhone3.dc.html`, 2026-09-29), built on v2
("getting there … starting to look good"). Continue from v3. v3 changes, all
Jack's asks: the ocean photo is ALWAYS the real `ocean.jpg`, **no colour
filter on any theme**; the **coloured section icons are back** (sidebar icons
from `js/core.js` in their `--page-*` colours, each section card bordered in
its page colour at 0.3); the layout stays close to the current page all the
way down; and Vessels became a **Career timeline** — a role-progression strip
(first year each `vessel_role` was held: Deckhand 2010 -> Lead Deckhand 2014
-> Bosun 2015 -> Chief Officer 2022) above a vertical timeline (start year +
node on the left, vessel card with its role pill on the right), linked
groups (Tenders / Onboard experience / References / Milestones) with their
own icons and colours under each yacht. The pages are generated from live
anon data by `build_profile3.py` + `profile3_template.html` in the session
scratchpad (not in the repo).
**2026-09-29, Jack: "render me the exact replica of the current public profile
with no color options, we can then build from there".** The canvas now opens
on `Current.dc.html` (+ `CurrentPhone.dc.html`): the live page's rendered DOM
(anon data for jack-sorrell, scripts/on* handlers stripped) with ALL 50 site
stylesheets + leaflet.css bundled into one uploaded CSS asset, `body.X`
selectors rewritten to `div.X` (same specificity; the wrapper div carries
`public-page public-profile-page`), and every signed image / map tile /
badge re-hosted as a canvas asset. Measured against the live page at 1280px:
all ten section boxes identical to the pixel, 30/30 images load. Static —
the page's JS (collapsibles beyond native `<details>`, "show more", the live
map) does not run on the canvas. **This replica is the new starting point;
v1-v3 are reference only.**
**Step 3 APPROVED by Jack 2026-09-29 ("i love it") — build this top for real.**
Canvas boards `Wave3.dc.html` / `WavePhone3.dc.html` (steps built as copies:
Current -> Wave -> Wave2 -> Wave3, each kept for comparison). Spec:
- **No topbar** (About / Privacy / "Create yours" removed from the top).
- **Wave band** at the very top: the real `img/ocean.jpg`, NO colour filter,
  `object-position: center 72%` (darker water behind the logo),
  `clamp(230px, 22vw, 290px)` tall, bottom edge faded with a CSS
  `mask-image` gradient (transparency, not a colour overlay) into the page's
  existing fixed ocean background. It is an absolutely positioned layer
  behind `<main>`; no shading panels anywhere.
- The logo row + heading live INSIDE `.public-profile-main`, before `#ppShell`,
  so they share the card's width/left edge at every breakpoint (a separate
  banner container drifted on phones).
- Row 1: logo (plain, left) | right: "Share profile" (outline pill) + "Download
  CV" (solid #5bbcff pill, dark text). **Phone: Share becomes a 44px round
  icon button with aria-label** so all three fit one line.
- Row 2, just above the card: "PUBLIC PROFILE" (12px, 800, #5bbcff,
  letter-spaced) / **"<rank> · <current vessel>"** h1 (clamp 22-28px, 800) /
  chips: availability, location, nationality (blue-tinted outline pills).
  Replaces the old `.dashboard-shell-head` ("Jack Sorrell — public profile" +
  subtitle), which repeated the name shown in the card.
- The rest of the page is unchanged from live.
**Open decision before building "Download CV":** generate live from the
profile, or only offer a CV the crew member has published — recommended the
latter so a half-finished CV never reaches an employer. "Share profile"
reuses `SeavShare.shareProfile`.
Decisions so far (all Jack's):
- **Keep the current page's structure.** Everything hangs off a vessel: each
  vessel card (real photo, role, dates, duration) opens to its overview
  (specs grid + "Experience onboard" text) and then its linked groups in the
  site's section colours — Tenders green, Onboard experience coral, References
  purple, Milestones amber — hidden when empty, as today. v1 (new layout,
  alternating colour bands, big display type) was rejected as "messy".
- **Crew photo must show** (ringed avatar on the profile card, which overlaps
  a themed wave banner). **Site font only** (system stack, 600/800) — no web
  fonts. **Real logo** `img/logo.png` on every theme, never tinted.
- **No "depth" metaphor** (no metres, abyss, glow dots) — it makes no sense
  in non-blue themes.
- **Themes, CV-generator style, crew choose their own.** Nine curated
  palettes (no free colour picker): Deck = the five CV schemes (Sea-V
  Original, Ocean Blue, Simple Green, Pearl Grey, Night Watch — same names
  and swatches as `CV_TEMPLATES`), Interior = Champagne, Rosé, Linen, Orchid.
  A theme changes ONLY the accent colour and the deep background hue (the
  wave-photo tint was dropped in v3 — Jack wants the real photo always);
  every theme is a dark, professional variant. Layout never changes per theme. Palette values
  are in `Profile2.dc.html`'s `themes()`.
Agreed build plan once the design is signed off: (1) new look on
`public-profile.html`, default theme only, behind a preview link
(`?look=new`) to compare with real data before switching; (2) the other
themes + a `public_theme` profile column (migration, anon grant,
PUBLIC_ARRAY_COLUMNS, smoke test) + picker on the Profile page (mock:
`Picker.dc.html`); (3) optional "use my current yacht's photo for the
waves", and the share card matching the theme.
Parked ideas: admin-only Claude integration via an edge function gated on
`is_admin()` (Jack: "shelf this for now"); green-crew steps 1b-4 (flatten
box-in-box nesting, menu that grows with the user, dashboard as a to-do,
first-run setup) and the dashboard header / quick-action inconsistencies.

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
   ~~storage path-planting~~ and ~~verification email rate limit~~ (both
   fixed v579);
   Master Unlimited counts pre-certificate sea days (`seav-data.js` ~2027);
   payslip total mixes currencies; `dashboard.html:72-76` duplicate script tags and
   dead `navigation-routing.js` (patch script re-inserts it); CSP allows
   unsafe-inline/eval and whole CDNs, supabase-js unpinned; `navigation_areas`
   / `tenders` have TABLE-level anon SELECT; auth-form focus outlines and
   modal dialog semantics; muted token 4.42:1 contrast. **Needs Jack's call:**
   day counts exclude the end date; overlapping contracts double-count; yard
   uncapped in the dated 36-month path; standby cap is per contract, not
   total; typography.css forces 14px so `--font-label` 11px can never apply.

10. **Public profile colours "don't match the private section"** (Jack,
   2026-09-27, parked by him). Not yet pinned down. Measured the live
   public profile: it reuses the private classes, and public-profile.css
   copies each page accent on purpose (e.g. Tenders group border =
   tenders.css shell green). Known differences: public shell border is blue
   while each private shell uses its page accent; public per-vessel groups
   have COLOURED borders while private vessel groups are neutral with a
   coloured dot (Jack's own 2026-08-05 call). The private pages need a
   login to measure. Next step: Jack signs in to the browser pane, or names
   the specific cards/dropdowns.

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
