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
- HEAD = **v614**. Jack pushes every commit himself from
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
only a bottom rule. Then slimmed ("a little smaller so thinner"): padding
`--bridge-head-pad-y/-x` 14px / 20px (was 28px), gaps 10/16px, icon
`--bridge-head-icon` 44px (was 72px). Sea Time measured 107px tall at
1280 (stacked: 277 -> 201px at ~700px). Then the square around the title icon went
too ("less is more"): no border/background, `--bridge-head-icon` 28px box,
26px svg in the page colour.

### v585 — held certificates complete milestones; testimonial redesign
- **Milestones** (Jack: "if you upload a cert that is in milestone it should
  automatically complete that section"). `SeavData.certCompletingGroup`
  + `CERT_GROUP_COMPLETED_BY` (seav-data.js): holding a CoC completes its
  Deck Progression group and the prerequisite groups — OOW also completes
  YM Offshore; Chief Mate <3000 also OOW + YM Ocean; higher Master tickets
  cover the smaller-vessel Master groups. Expired certs count; matched by
  catalogue CODE only (custom names do not). Used in
  achievements-engine `isTriggerMet` (awards it), `computeMilestoneProgress`
  (100%, "Certificate held — …") and `getInProgressCertGroups` (drops it
  from "in progress"). The engine never revokes a cert-group milestone on a
  page where certs are not loaded. Node 12/12; on Jack's data the dashboard
  went from YMO 100% / YM Ocean 100% / Master500 94% to Master500 94% /
  Master3000 47%.
- **Testimonial printout redesigned** (Jack: "the logo, better layout ...
  professional but new age"), `printTestimonial` in js/seav-testimonial.js:
  full-bleed A4, navy header with the real logo (`location.origin/img/logo.png`
  — the print window is about:blank, relative paths do not resolve), brass
  rule, "Confirmed by Master" chip + reference `SV-<last 6 of id>-<yyyymmdd>`;
  hero (capacity, vessel, dates, flag, GT, days signed on inclusive); four
  big figures (brass top edge + "Master's figure · logged N" when the
  captain corrected one); Seafarer | Vessel definition lists; declaration
  with script signature, signature line, master details, comment, and an
  SVG brass seal; footer with the MIN 543 note. print-color-adjust exact.
  Rendered on a harness with the demo confirmation.

### v586 — held CoCs complete Milestones rows; miles + owner/guest days; slim testimonial bar
- Jack: "the chief mate and the oow didnt automatically complete even though
  i have the cert uploaded". The BADGES were already awarded (v585); the
  Milestones page rows still read "Sea time met · N certificates
  outstanding" because `certRowReadiness` checks the prerequisite courses.
  `heldCertFor()` in achievements.js (wraps `SeavData.certCompletingGroup`):
  a held CoC (or higher) makes the row ready, hides the prerequisites list,
  shows "Certificate held · <name>" and the unlocked badge art.
- **DB, LIVE:** `seatimes.nautical_miles` (0..200000) and
  `seatimes.owner_guest_days` (0..5000), both nullable (blank = not
  recorded), private (anon column grants not extended).
  `docs/schema-seatimes-miles-owner-guest.sql`; testimonial preview /
  complete carry `miles` + `owner_guest`, the guard marks a Confirmed entry
  Changed when either is edited. Sea Time form: two new fields (owner/guest
  days can't exceed days signed on); table shows them under the total.
  Captain's page (verify-testimonial) can correct both. NOT MCA figures —
  the printout shows them in a separate row saying so, and only when set.
- Testimonial printout header: one slim navy bar (no brass rule, no chip),
  logo 7.5mm like the CV generator's brand mark.
- PYA / Nautilus testimonial templates are members-only (not readable
  from here); the public guidance asks for sea / standby / yard (+ watch)
  broken out, which the printout already does.

### v588 — Sea Time rows: one Actions menu
Jack's screenshot: each row had four or five buttons and two stacked pills
("messy ... maybe a dropdown"). Now: one status pill with the captain's
answer as a quiet dot line under it (`.seav-tst-line` is-ok / is-wait /
is-bad, `--seav-tst-*` tokens); the SST column is "SST file" with a plain
"View" link or "None"; ONE "Actions" button per row. New shared
`js/seav-row-menu.js` + `css/components/row-menu.css` (tokens
`--seav-row-menu-*`; Bridge squares the radius): a `[data-row-menu]`
button + a sibling `<template class="seav-row-menu-items">`; the items are
copied into one `position: fixed` panel on <body> (a panel inside the row
is clipped by `.seatime-table-wrap`'s overflow) and keep their data-*
attributes, so the page's own document-level handlers run unchanged.
Arrows / Home / End / Esc (focus returns) / Tab; closes on outside click,
scroll and resize. Items: Edit entry, Add passage plan, the testimonial
action (`SeavTestimonial.actionHtml` now returns a menu item), Delete
entry. The row carries `data-seatime-id` (added to seav-search
FOCUS_ATTRS) because the edit button now lives in a <template>.
Reusable on any other table. Verified on the Sea Time harness at 1440 and
375: menu items per status, edit opens the right entry, print opens the
testimonial, keyboard + Esc, menu inside the viewport on a phone.

### v589 — dashboard loses its colours; brass becomes one blue accent (2026-11-03)
Jack: the dashboard colours "dont look professional anymore and wont be
taken seriously"; keep them on the menu icons for now; "the topbar yellow
line can go"; simplify, rebuild the look if need be. All in
theme-bridge.css: `--bridge-brass` is gone, replaced by `--bridge-accent`
(= `--accent-blue`) + `--bridge-accent-soft` (= `--pill-blue-bg`), used
only for STATE (hover, selected, progress, callout edge). Topbar line
token transparent / 0px (also clears the same line atop the Search panel
and the public pages' `.legal-topbar-inner` inset). Dashboard tiles and the
current-vessel tile: one neutral border, no `--a` page-colour left edge
(the inline `--a` styles in dashboard.html are KEPT: dashboard.css still
reads them, and they come back if the Bridge @import is ever removed). Dashboard
title icon + profile-completion icon: `--bridge-caption`, no badge. Menu
icons keep their page colours (topbar.css untouched). Seen on a static
harness of the real dashboard markup + styles at 1280px. Still coloured
elsewhere: every OTHER page's title icon is in its page colour.

**Repo health, found 2026-11-03:** this folder is on iCloud Desktop sync.
iCloud had removed `.git/index` (left a stale `index 2`), so git showed
every file as deleted; rebuilt with `git read-tree HEAD`. The folder was
also a stale v559 with partial v567/v586 files synced in; fast-forwarded
to origin/main. **Local history has missing objects** (`git log` fails at
022f84d). GitHub has the full history. Fix: fresh clone outside iCloud
(e.g. ~/Developer/sea-v). node_modules reads are very slow here for the
same reason (eslint took minutes).

### v590 — audit fixes: overlaps, payslip currencies, anon column scope (2026-11-03)
Jack: "Code fixes, in order". Thread 9 re-checked first: end-date
counting (inclusive since v571), Master Unlimited pre-cert days (v572),
muted contrast (0.64 since v539) were ALREADY fixed; yard uncapped on the
36 months is CORRECT (MSN 1858: signed-on time irrespective of activity;
the 90-day cap is the OOW 115-day figure's). `profile.schengen_stays` was
already dropped.
- **Overlapping contracts.** New `SeavData.uniqueSignedOnDays(entries)`
  merges signed-on spans so each calendar day counts once; used by the 36
  months and every Master onboard figure (500 / 3000 x3 / Unlimited).
  Spans come from `signedOnDays`, so non-overlapping totals are identical
  (node 9/9 in London + LA; live anon data for 4 public profiles:
  unchanged, none overlap). Sea Time save now refuses an entry sharing
  2+ days with another (one changeover day allowed; open entries run to
  today) — the day buckets cannot be de-duplicated, so stop it at source.
- **Standby.** Deliberately NOT a flat 14-per-contract cap (would cut
  legitimate multi-period standby). Kept the per-entry cap at actual sea
  days; the form now states the MSN 1858 rule (14 in a row, never more
  than the voyage before). The captain's testimonial confirms the figure.
- **Payslip net total per currency** (`renderKpis`, payslips-core.js):
  was one sum labelled with the first entry's currency. Never converted;
  `OTHER` shows as "N other". Lines joined with <br>.
- **DB, LIVE:** `docs/schema-anon-column-scope-navigation-tenders.sql` —
  anon's TABLE-level SELECT on navigation_areas / tenders replaced by
  column grants of exactly the current public lists (every existing
  column was already public, so no visible change; new columns now start
  private like every other table). Smoke test: 0 table-level grants,
  28 / 15 columns, authenticated untouched, anon rows 58 / 23 before and
  after, anon insert 401, advisors 23 -> 23. `testNavigationTenderColumns`
  added to test-supabase step 1 (passes).
- Drafting notes removed from privacy.html ("have it reviewed by a
  qualified lawyer") and terms.html ("Have a lawyer review ...").
- **DATA, LIVE:** the 3 hand-set demo "Verified" references (demo-r2/3/4,
  daniel-whitfield, no verification blob) set to Draft at Jack's call
  (`docs/data-cleanup-demo-references-draft.sql`, restore line inside).
  Anon now reads 0 of them, so daniel-whitfield's public profile has no
  References section (v577 hides empty ones). **SEA-V now has NO verified
  references at all** — the first real one will come from the referee flow.
- **CSP + pinned CDN scripts.** supabase-js `@2` (floating) pinned to
  2.118.0's `dist/umd/supabase.js` (the file `@2` served on 2026-11-03,
  published 2026-10-15), topojson-client 3.1.0, world-atlas 2.0.2. Every
  CDN `<script>` (22 supabase, 15 html2canvas, 3 each topojson / jszip /
  qrcode) and the two JS loaders (jszip in auth.js, heic2any in
  seav-upload.js) carry sha384 `integrity` + `crossorigin`. The rules in
  patch-html-scripts.mjs insert the pinned tags. CSP (vercel.json +
  netlify.toml): script-src lists exact library PATHS, not whole CDNs;
  style-src only leaflet's; connect-src only world-atlas on jsdelivr;
  `object-src 'none'` added. **Kept:** `'unsafe-eval'` — heic2any's
  emscripten build calls `new Function` (no other library needs it);
  `'unsafe-inline'` — inline <script> blocks and handlers remain. Tested
  on a local server sending the real header + a sessionStorage
  violation recorder: public profile (data, map, tiles, atlas), 8 more
  pages, 0 violations; jszip + heic2any load and run; a wrong hash and an
  unlisted jsdelivr file are both refused. **To upgrade a library:**
  version + sha384 in the HTML (or patch script) + the CSP path, together.
- **Keyboard focus.** New `css/components/focus.css` (imported after
  theme-bridge.css; tokens `--seav-focus-ring-*`): one 2px `--accent-blue`
  `:focus-visible` outline on every control, `!important` because 14 page
  rules set `outline: none` (sign-in / sign-up fields among them). Only
  outline is set, so existing focus borders/glows stay; mouse clicks on
  buttons draw nothing. Not ringed: aria-activedescendant listboxes and
  the modal card itself.
- **Modal focus** (`wireModalFocus` in core.js). role / aria-modal /
  aria-labelledby were already applied (v577). New: a MutationObserver on
  `.modal[hidden]` (pages open modals directly, not only via openModal)
  moves focus to the card on open (card, not first field — no phone
  keyboard pop), Tab / Shift+Tab cycle inside the open modal, close
  returns focus to the opener. The "×" gets `aria-label="Close"`.
  Verified on a harness of the real vessels.html + core.js: Enter opens,
  focus inside, Tab -> Close, Shift+Tab wraps to Save, Tab wraps back,
  field ring visible, Esc closes and focus returns to "Add Vessel"; ring
  on the real sign-in page under the new CSP. Not tried with a screen
  reader. Any future custom popup outside `.modal` needs its own trap
  (search and badge-unlock already have theirs).
Thread 9 is now down to the 11px label size (fold into the redesign).

**Also v590 — Quiet navy + a Dark / Light switch** (Jack, 2026-11-03:
"simplify this website"; shown A Quiet navy vs B Light side by side, he
asked for both, switchable).
- **Quiet navy = Dark, the default** (end of theme-bridge.css, app pages
  only): ocean photo gone (`body.app-page::before/::after` hidden — this
  REVERSES the v583 "ocean back" call), page title icons in
  `--bridge-caption`, title row unboxed (heading over one rule), tile /
  quick-action labels normal case. Public info pages keep their ocean.
- **The ink conversion.** 627 hardcoded whites in 41 stylesheets plus 26
  white tokens in variables.css now read `rgb(var(--seav-ink-rgb) / a)`
  (`--seav-ink-rgb: 255 255 255`), and 44 blue TEXT colours read
  `--seav-accent-text` (= `--accent-blue`). **Proved pixel-identical in
  Dark:** a no-cache server compared the converted CSS against a reversed
  copy — 0 computed-colour differences over 3,878 elements on 6 page
  harnesses with every modal open. **New CSS: write colours as ink /
  tokens, never a literal white,** or Light misses them.
- **Light** = `css/core/theme-light.css` (after theme-bridge, before
  focus.css), gated on `html[data-theme="light"]:has(> body.app-page)` —
  the public profile measured 0 differences over 1,682 elements with the
  attribute set. Flips ink to navy (15 34 54), Bridge surfaces to white /
  #f3f5f8, labels + accent + focus ring to `--light-accent` #1f6fb2
  (#5bbcff is 2.2:1 on white). White fields (the dark rgba(0,0,0,.22)
  fill read as disabled), white select popups, autofill fixed. **Keeps
  white ink locally** on the vessel tile WITH a photo (desktop scrim),
  `.btn-danger`, the navigation map + hint, leaflet. A sweep of 6 pages
  (all modals open) for dark fills and low-contrast text is clean apart
  from those intended dark areas.
- **Switch:** `SeavTheme` in seav-config.js (sync in <head>, so no flash;
  localStorage `seav_theme`, per device, default dark) +
  "Appearance: Dark | Light" in the account menu (core.js
  `wireThemeSwitch`, aria-pressed, live, menu stays open). Verified on the
  harness: switch, persist across pages, back.
- Not checked in Light: pages without a harness here (achievements,
  references, tenders, onboard, payslips, hobbies, land, specialist, CV
  generator, admin) and anything that renders only with real data —
  check signed in. Phone dashboard: tile labels crowd under wide figures
  at 375px in BOTH themes (seen with "1,197 days"); not caused by this.

### v591 — faint ocean behind signed-in pages
Jack: "I would like the ocean wave back ... even if its faint, it will
create a nice contrast". Quiet navy no longer hides `body.app-page::before`;
`--seav-ocean-opacity` is 0.32 in Dark and 0.16 in Light. The tint layer
(`::after`) stays off. Also in this commit: `docs/schema-profile-public-theme.sql`
(applied live 2026-11-03; column + `get_public_profile` return it). The
picker and theme CSS are not built yet.

### Shipped 2026-11-05 (v604, same commit) — vessel tile readable in Light
Its meta line (`--muted`) and chip (`--pill-*`) resolved on <html> as navy, so the tile's local ink
reset missed them. Set locally in theme-light.css.

### Shipped 2026-11-06 (v614) — guide uses the site's date fields and the yacht directory
Jack tried "New here?": the calendar did not work and the directory was missing. Review of js/seav-guide.js found more:
- Dates are the site's year / month / day selects (`mountDateFields`), kept across redraws. A half-finished or impossible date now errors; it used to save as nothing or as written.
- **Bug:** a yacht added here always saved with no end date, so it became the crew member's CURRENT vessel. Now "I still work on this yacht" (ticked by default) or When you left. Start date required.
- **Bug:** "Your role" was free text, which the v571 position list exists to avoid and which the Master rules read. Now the same select.
- **Bug:** certificates had no issue date, which "while holding" rules need, so the Master tiers could never open from one. Date issued added. All catalogue certificates are offered, most common first.
- Directory: `SeavVesselFinder.attachYachtSearch` is now shared by the vessel form and the guide. Picking a yacht copies its facts and `directory_id` once, as the form does; changing the name unlinks it. dashboard.html loads the finder statically.
- Reopening the guide starts clean. Step 3 says where things are.
Tested on a page copy with a stubbed directory and stubbed saves: every error, redraws, saved payload. **Not tried with a real account or a real save.**

### Shipped 2026-11-06 (v613) — dashboard refocused: needs attention, one totals card
Jack reviewed Y.CO's home page for ideas ("layout, clarity, purpose"), not its vessel data sheet: "the pages totals etc in one card and less info". Keeps the v612 ruled look; replaces its Certificates, Sea time, Ready and Navigation cards.
- Layout: Current vessel | Needs attention + Your next ticket (`.dash-stack`); Your records | Crew support; Latest from the MCA | Regulations and guidance.
- **Needs attention** (`renderAttentionCard`): only what crew can act on, at most 6 rows, one line per kind of gap: expired then expiring certs (each its own row), testimonials declined or edited since signing, declined references, missing profile fields, finished entries with no testimonial, no verified reference. Awaiting someone else is not listed. The profile completion strip is gone (the row replaces it; the title tick stays).
- **Your records:** every page's total plus CV and public profile. Next ticket is name, % and bar; the requirements stay on Milestones. `navigation-passage.js` removed from the dashboard again (no miles here).
- **MCA notices:** five, "New" per device until opened or Mark all as read (localStorage `seav_mca_notices_seen`). Regulations gain a Source column and COSWP 2026. Crew support gains SeafarerHelp.
**Not built:** "last updated" dates on records, left out to keep it lighter. Tested on the page copy with live public data plus empty and expired accounts. Not seen signed in.

### Shipped 2026-11-05 (v612) — dashboard cards as ruled tables; vessel details over the whole photo
Jack: the cards need to look more professional, the photo uncut with the writing over it as before, "lines and tables that separate number from titles", "too much loose information floating". Reverses the big-number look of v610.
- Every card: a ruled header band, then `figures()` (`.dash-figures`, a strip of label-over-number cells with rules) and `table()` (`.dash-table`, real tables with labelled columns), in js/dashboard-snippets.js. tables.css gives every table a 720px minimum, so `.dash-table` resets it.
- Vessel: `.is-photo` card takes the image's own shape via `--dash-vessel-ratio` (set from naturalWidth / naturalHeight), so the photo is whole unless the card beside it is taller. Details over the foot on `--dash-vessel-scrim`, white in Light too (theme-light.css resets the tokens locally). At <=560px the details sit under the photo.
- Your next ticket now tables `getSubRequirements()`: Requirement / Done / Needed under each ticket with its bar, replacing the long engine sentence. Six MCA notices, up from three.
Tested on the page copy with live public data, Dark, Light, phone. Not seen signed in.

### Shipped 2026-11-05 (v611) — sea-time rules against MSN 1858 Amendment 2
Compared with the PDF sentence by sentence (published 18 May 2026; §4 is new, so old §4.x are now §5.x), then all nine differences fixed at Jack's word ("sort it out"), `js/seav-data.js`:
- `serviceMonths()` is §5.3: whole calendar months from each span, odd days at 30. `DAYS_PER_MONTH` is 30, only for figures held as day counts. A full 1 Jan - 31 Dec used to read 11.99.
- `deckServiceFactor()` is §5.1: non-deck roles 0, Deck / Engineer 0.5, blank 1. Used by the OOW figures, the 36 months, recency and Master <200GT. **Deck / Stew counts in full: the notice halves only engine and deck, a reading not confirmed with the MCA.** Deck / Engineer stays 0 for Master, as it is not a deck officer role.
- 36 months: "since the age of 16", `entriesSinceAge16()` with `context.dob`. The public profile has no date of birth, so nothing is clipped there. It now reads in months (`met` = months >= 36), not 1095 days.
- §5.1 / §12.1 recency applies to every tier. 180 days now (was 183), yard capped at 90. Earned badges stay earned (PERMANENT_ONCE_EARNED_TRIGGERS). A progress bar is capped until it is met, with its own row.
- **Master <200GT counts actual sea days only** (§3.1(b) + §5.2). It used to add stand-by and uncapped yard. §3.3(c) is the one place that spells out a wider mix. **Our reading, not confirmed with the MCA.**
- Master <500GT / <3000GT watchkeeping only from deck officer entries. Master Unlimited gains the Chief Mate Yachts Unlimited route (`MASTER_UNLIMITED_ROUTES`). OOW entry row accepts Coastal + Coastal Skipper or IYT Coastal (`allOfAlt`). Badge text and section numbers corrected.
Node: 37 rule cases pass. Old vs new on 4 public profiles: no badge flips. Jack: Master <200GT 39.3 -> 26.7 months (still met), <500GT 18.4 -> 18.3 months, watchkeeping 113. Daniel (demo) watchkeeping 1590 -> 1560. Their dates of birth are private, so age 16 was not run on them.
**Not done:** §4.4(a) Master Unlimited prerequisite list has no Chief Mate Unlimited modules; §5.4 service as Master must be signed by the owner or yacht manager (the testimonial flow asks a captain); the OOW Unlimited route; load line length (the code reads the vessel's length field). Thread 5: §3.6 confirms 3-year validity for Master <500GT module passes (Celestial Navigation 1 year); footnote 7 anchors the EDH 18 months to CoC issue; "while holding" from issue or exam pass is still unstated.

### Shipped 2026-11-05 (v610, same commit) — dashboard as two columns of paired cards
Jack rejected a links-first mockup ("no direction"), asked for research first, then approved eight cards, two per row.
Most important top left: Current vessel + Your next ticket; Certificates + Sea time; Ready for your next job + Your other
records; Navigation + Crew support; Latest from the MCA + Regulations and guidance (added in the same commit). Mockup: `design-concepts/dashboard-cards/`. Replaces the v516 bento (its CSS, JS and theme rules are gone).
- `js/dashboard-snippets.js` rewritten (`render*Card`, all text escaped, fingerprinted so the photo does not flash).
  `css/pages/dashboard.css` DASHBOARD CARDS, tokens `--dash-panel-*`, `--dash-cards-*`. `.dash-panel` is in the box lists in
  typography.css and theme-bridge.css, which give it its fill and hairline. Title classes in type-hierarchy.css.
- dashboard.html loads `navigation-passage.js` again for total NM (removed 2026-08-22). The engine now exports
  `getEarnedAchievementCodes`; the Milestones count is distinct codes.
- Your next ticket shows the engine's own weakest-progress label, so the wording is long and technical. Review it signed in.
- Crew support is static HTML, numbers checked on 2026-11-05. Re-check them now and then. Links only, no Instagram embed.
Tested on a copy of the real page with Jack's live public data plus empty and expired-cert accounts: Dark, Light, phone.
**Not seen signed in.** Payslips, testimonials and public-profile status are private, so only stubs exercised those rows.
Jack's own current Senses record has MMSI 12345678 (v609 flag), and the card shows it until he corrects it.
**Latest from the MCA is live:** the browser asks GOV.UK's public search API at most daily per device (localStorage `seav_mca_notices`,
no cookies or referrer), keeps numbered MGN / MSN / MIN titles with M in the code (fishing-only "(F)" dropped), allows only gov.uk paths, escapes all
of it, and on failure uses the last good copy or a line linking to GOV.UK. CSP `connect-src` allows exactly `https://www.gov.uk/api/search.json`
(vercel.json + netlify.toml). Privacy policy (dated 5 Nov 2026) and record of processing name GOV.UK. Tested live under that policy, plus failure and
hostile replies. Regulations are constants in js/dashboard-snippets.js, links checked 2026-11-05; `FLAG_REGISTRIES` adds the current yacht's registry
for 5 checked flags, others add no row. Malta, Gibraltar and BVI were left out because their sites did not answer the check.
MSN 1858 now links Amendment 2; the sea-time maths was checked against Amendment 1, so it still needs comparing.

### Shipped 2026-11-05 (v609) — shared yacht directory
Jack: a vessel should save to a shared database, keyed by number. `vessel_directory` = facts, one row per hull;
`vessels` stays each crew member's record and gains `directory_id`. Identity: IMO (check digit), then MMSI, then
official number + flag; **name alone never links or creates**. `docs/schema-vessel-directory.sql`, applied and
smoke-tested as the real role: 26 vessels, hash of every old column unchanged, 7 entries from valid IMOs, 9 records
linked, demo account's fake IMOs excluded by the check digit, one flag (Senses MMSI 12345678). Anon 401, advisors 23/23.
- Signed-in members read and add; only admin edits. `created_by` not readable; 20 additions a day (trigger in `private`).
- Form: "Find your yacht" (`js/seav-vessel-finder.js`) copies facts into EMPTY fields once. Later directory edits never
  touch a crew record, so a testimonial keeps the yacht as it was. `SeavAPI.resolveVesselDirectory` on save links or adds,
  and writes differences to `vessel_directory_flags`; failure never blocks the vessel save.
- Admin page: "Yacht directory to review", use their value or keep the directory. Privacy policy and record updated.
- Not linked: records with no number, including 3 name-only Senses. They link when the crew member adds a number or picks it.

### Idea, needs a serious plan first 2026-11-05 — shared passages per yacht (NOTHING BUILT)
Jack: passages logged against each yacht, so a crew member on the same passage can be added by a shipmate, or find it by searching
e.g. Senses. `vessels.directory_id` (v609) is what makes this possible. Yacht history from today only is fine; how history items get
used is not decided. Do not start building without a plan: yacht movements and who was aboard are sensitive, and tagging needs consent.

### Shipped 2026-11-05 (v610) — a history for every yacht
Jack: update from online data, and "a history for each vessel with more and more information". `vessel_directory_history`
(`docs/schema-vessel-directory-history.sql`, applied + smoke-tested): triggers log every addition and change with old value, new
value and source (crew / admin / wikidata); members read, nobody writes directly, no user ids. **Linked crew records fill BLANK
directory fields** (sanity-checked, demo ignored, cannot block a save); they never overwrite. Direction is one way: directory changes
never reach crew records. Wikidata updates applied to Senses, Grace, Kahalani, Stella Maris, Northern Star (list in the .sql). Crew
records still say 59 m on Senses, so their next save raises a review flag. "Yacht history" on the Vessels card, owner only, not on
the public profile. Advisors 23/23. A next step would be yacht pages and more sources.

### Directory seeded 2026-11-05 (DB only, no site change)
Jack asked for a list of superyachts. `docs/data-vessel-directory-seed-wikidata.sql`: Wikidata (CC0), yacht types with a valid
IMO, 24 m and over. New column `vessel_directory.source` ('wikidata', null = from crew). See the header for filters and undo.
Existing entries untouched, so Senses keeps 59 m where Wikidata says 57, Grace 2083 GT where it says 2306. Community data,
details can be stale; the form already asks crew to check. Not used: commercial lists and vessel-tracking sites.

### Ocean strength settled 2026-11-05 — faint everywhere
Jack tried raw (v604), 0.7 (v605, v607), then: "more faint ... it doesnt look very good". Signed-in and
public info pages are now 0.32, the same as the public profile's dark palettes, with v593's fade back.
No tint or filter. Change the strength only when asked; the raw look was tried and rejected.

### Shipped 2026-11-05 (v607) — still wave inside; public pages line up
Jack: the wave should not move in the signed-in area, needs better quality, and all public pages
should line up. `animation: none` on `body.app-page::before`. **img/ocean.jpg is only 1024px**: remade
at 2048 (Lanczos + unsharp, 342 KB, was 113) so it is crisper, but no real detail was added; a truly
sharp wave needs a larger original (none found on this Mac). Public info pages: same untinted 0.7
photo, overlay off, drift kept; titles on the --type-* scale (legal h1 38 -> 20, h2 20 -> 16); login
blue #449cff -> --accent-blue; referee + captain logo 27 -> 120px. **Sign-in and sign-up float on the wave with no card: Jack's deliberate exception** (a card was tried and rejected). Public profile NOT changed.

### Shipped 2026-11-05 (v606)
Profile share panel: "Share a read-only career view with employers" removed (Jack: it made the title row too large).

### Shipped 2026-11-05 (v604 raw, v605 dimmed) — ocean photo at 0.7, no tint or filter
Jack: "remove whatever glass or filter over the ocean", then "Keep it raw", then "dim it a bit". `--seav-ocean-opacity` 0.7 in both themes; change the strength only when asked.
Signed-in pages only: no fade, no tint, no filter. Values to restore are in a comment in
theme-bridge.css. This brings back v593's banding risk (the photo's near-black lower third).

### Shipped 2026-11-05 (v604, same commit) — pop-ups readable in every colour scheme
Jack: the Download CV "coming soon" box was unreadable on his public profile (Pearl Grey). Toasts
had a fixed navy fill while their text is the ink, which flips dark in the light palettes AND in app
Light (1.2:1), so every save message in Light was unreadable too. New `--seav-popup-bg` (+ `-ok`,
`-info`) on toast, page loader, badge tooltip, badge-unlock card and the map note. Photo viewer: white
text always, as its backdrop is dark. **Rule: a pop-up never gets a fixed dark fill with ink text.**

### Shipped 2026-11-05 (v604) — + Add moved next to Search
Jack's ask. Now first in `.nav-right`, wrapped in `.topbar-add`; its links carry `.topbar-add-item`
because layout.css's `.nav-right a[href]` pill rule catches any link there. At <=560px it is a
34px "+" (aria-label Add) and its menu anchors to the bar, or the logo shrinks to nothing at 360px.

### Parked 2026-11-05 — upload a CV and create records from it
Jack: "leave this to a later date". Plan in `docs/product/cv-upload-plan-2026-11-05.md`. Nothing built.

### Shipped 2026-11-05 (v603) — quick action row gone; white + Add
Jack: + Add replaces the dashboard's five buttons (vessel, sea time, certificate, onboard, Build
your CV). Row, its JS and CSS removed; `.dash-bento` offset 283px -> 227px. "Build your CV" now only
lives in the photo menu. + Add text is white in both themes at Jack's ask (2.1:1 on #5bbcff in
Dark, same as `.btn-blue`).

### Shipped 2026-11-05 (v602) — old dashboard back, plus a skippable guide
v601 replaced the dashboard with a next-step home, a menu that grew and a + Add button
(mockup: `design-concepts/green-crew-home/`). Jack, after seeing it: "not sure this is what
i had in mind ... i like the old dashboard"; he wants a guide for green crew that "you can
skip" and "just takes you to the dashboard". **v602 restores dashboard.html, js/dashboard.js,
js/dashboard-snippets.js, js/core.js, topbar.css and the patch script from v600** and removes the
home page. The growing menu went with it: ask before bringing it back. Do not rebuild the
dashboard as a to-do list without asking.
- **+ Add stayed** (Jack asked for it back): on every signed-in page, yacht, time on a yacht,
  certificate and onboard experience go to `dashboard.html?add=<key>` and open the real form
  (`openAdd`, js/dashboard.js); passage and reference go to their pages.
- `js/seav-guide.js`, `css/pages/guide.css`, tokens `--guide-*`, `#guideShell` beside
  `#dashboardShell`. Three steps (name + role; one yacht or certificate or nothing; what to do
  next) with a CV filling in beside them. Skip on steps 1-2; every exit reaches the dashboard.
- Opens by itself when there is no rank, vessel, sea time or held cert, and a fresh profile read
  agrees (a failed load also looks empty). Skip is remembered per device (localStorage
  `seav_guide_skipped`), so it can offer itself once more on another device. Menu foot:
  "New here? Start the guide" -> `dashboard.html?guide=1`, any time.
- The profile save merges onto a fresh row read (it writes every column; 2026-08-07 data loss).
Tested on the real dashboard page with stubbed data: empty account opens, skip, no reopen, finish,
established account not interrupted, link reopens, 390px. Vessel and cert inserts as the real
authenticated role, rolled back (v601). **No real sign-up tried yet.**

### Shipped 2026-11-05 (v600) — miles from linked passages, as an option
Jack: linked passages gave no miles on the testimonial; "an option as it might cause
confusion". Sea Time form, editing an entry with linked passages: "3 linked passages ·
1,430 NM [Use this figure]" (`renderLinkedPassageMiles`, js/seatime.js). The button only
fills `st_miles`; nothing is automatic, a later link never changes a saved figure, a new
entry shows nothing (no id to link to). Passages with no route are named as not counted.
`SeavNavigationPassage.getEntriesDistance` gives navigation.html's same figure.
seatime.html now loads ports / helpers / passage (68 KB) and `navigationAreas`. No
schema change. Tested on a stubbed copy of the real form; not tried signed in.

### Shipped 2026-11-05 (v599) — the title hierarchy on the public profile
Jack: "Yes, apply it". Second block of type-hierarchy.css, both layouts. Sections are
boxes there, so their headings are grey card titles (ink at `--type-card-grey` 0.66, so
it follows the palette); groups and field labels are the palette accent; hero 20/800
(was up to 28); vessel overview name 16/800 (was 21/950). Crew name keeps its larger
size (v548, Jack's ask). Measured on live anon data, Current and Modern, all 5 palettes:
one size per level, lowest contrast 5.4:1. jack-sorrell's saved choice was already
Modern + Pearl Grey, so the picker works.

### Shipped 2026-11-05 (v598) — one title hierarchy on signed-in pages
Jack: dashboard card titles "very small and grey", titles differ page to page;
"white for the big titles, grey for the card titles and maybe blue for the inner
card titles". New `css/core/type-hierarchy.css` (after the themes, before focus.css)
and `--type-*` tokens: **page 20/800 white, section on the wave 16/700 white, card
14/700 grey (`--bridge-caption`), record name 14/800 white, inner title and field
label 14/700 blue, KPI caption 12/700 blue (was 10px).** New titles: add the class to
a list there; do not set a title's size or colour in a page stylesheet. Record names
stay white under the field-label rule even though they sit inside cards.
**Not changed:** public info pages, modals, and the existing `--font-*` tokens (other pages read them). Measured on 14 harness pages in Dark and Light: one value per level.
Harness has little record data, so most record rows were NOT rendered: check signed in.

### Shipped 2026-11-05 (v597) — Profile photo row one third / two thirds
Jack: the photo box took half the row. `.profile-banner` is now 1fr / 2fr; the four
fields stay 2 x 2. From 1001-1100px wide the photo's text drops under the photo
(`--profile-photo-text-min` 140px), which leaves empty room under the fields there.
<=900px still stacks as before. Measured on the harness at 390-1440: 33% from
1001px up, no sideways scroll. Not seen signed in.

### Shipped 2026-11-05 (v596) — same wave in Dark and Light; only boxes change
Jack: the wave the same in both themes with no filter, titles on it white in
both, only the boxes change. Works because the page behind the boxes is now navy
in Light too (Light no longer sets `--bridge-bg`). Ocean is opacity 0.32 in both,
`filter: none`, and the navy tint gradient over the photo is gone (theme-bridge.css),
so the wave is visibly stronger in Dark as well. **Reverses the v593 softened Light
wave.** Text directly on the wave keeps white via the list in theme-light.css: a
NEW heading or note placed on the wave must be added there. Worst case on the
brightest photo pixel in the title zone: white 8.8:1, section notes about 4.4:1, blue
links 3.7-4.2:1. 14 harness pages in Light, 379 text items: nothing under 3:1 caused by this
(the white-on-blue button, the faint copyright and the dimmed Coming Soon were
already like that). Not seen signed in.

### Shipped 2026-11-05 (v595) — optional "Modern" public profile layout
Jack: "the current one to stay exactly like it is, but have the option to choose
something more modern ... default is the current layout". A movable, modular page
was raised and deferred by him as a bigger project. He picked **Bento + Timeline**
from the four previews.
- New column `profile.public_layout` (`current` default | `modern`), read only
  through `get_public_profile()` like `public_theme`, no direct anon grant.
  `docs/schema-profile-public-layout.sql`, applied and smoke-tested: all 15 rows
  on `current`, every old column unchanged (hash match), owner write works as the
  real `authenticated` role, another user's row 0 rows, bad value refused, RPC ACL
  restored, security advisors 23/23. `testPublicThemeRpc` now covers it.
- Picker under the colours in Profile settings (`initPublicLayout`,
  `SeavAPI.savePublicLayout`). `?layout=modern` / `?layout=current` previews on any
  profile without saving; Share strips it.
- `js/public-profile-modern.js` MOVES the existing sections, it does not render
  copies, so records cannot differ between layouts. It moves them BEFORE they
  render, because Leaflet measures its container when it paints. New tile data
  (`#ppmMe`, `#ppmYacht`, role strip) uses textContent only.
- `css/pages/public-profile-modern.css`: every rule gated on
  `html[data-pp-layout="modern"]`, colours from `--ppt-*`. Timeline is
  single-sided, NOT alternating as in the preview: an open vessel needs the width.
- Verified: Current has no attribute, no moved nodes, and 0 elements change with
  the new sheet off (1,682 compared; the only diff is the ocean's own drift). Modern
  on live anon data at 1280 and 500 wide (two profiles, 390 no sideways scroll),
  all five palettes 6:1 or better on tile text. **Not seen signed in:** the picker
  has not been clicked; the write path was tested in SQL only.

### v594 — every modal matches; roomier Search box (2026-11-03)
Jack: "make sure the modals all match", then "the search tab where you
write is too small, the row is too narrow and the writing barely fits".
- **Modal audit** (harnesses of the 11 pages with modals + the 3 shared
  ones, every modal opened, computed styles compared, both themes; 17
  distinct modals). Already identical: card, header band, title, labels,
  fields, Save bar, Save / Cancel, close button. Fixed (theme-bridge.css,
  Quiet navy block): header icon was in 10 page colours -> caption grey;
  the header's 3px page-colour top stripe (`inset 0 3px 0
  var(--modal-accent)` in modals.css) removed; three note styles
  (.modal-intro 0.62, note / footnote 0.64 at 500, date hint 600) -> the
  muted token at the body weight. modals.css: the contact modal's
  `.modal-info-box--link` is an <a> and showed browser link blue
  (rgb(0,0,238)) -> `color: inherit`. Re-measured: one value per
  property in both themes. Deliberate differences left: the wide (660px)
  long-form modals, the compact date-triplet selects. The
  `modal-card--<colour>` classes are now inert under the theme (their
  `--modal-accent` only fed the icon and stripe).
- **Search**: the input was 19px tall in a 53px row at 14px. Now
  `--seav-search-input-height` 32px, `--seav-search-input-size` 16px
  (also stops iOS zooming on focus), `--seav-search-field-pad` 14px 20px.
  Gotcha: typography.css pins input font-size with !important at 0,2,1
  (its `:not(.legal-topbar *, ...)` adds a class), so the override is
  `.seav-search .seav-search-field .seav-search-input` + !important.
  Checked at 1280 and 375px.
- **Notification panel** (Jack: "dark when opened in the light page"):
  `.notif-bell-panel` (layout.css) was `var(--navy-900)`, which no theme
  flips. Now `--seav-menu-bg` + `--seav-menu-shadow` like the menu,
  account and Search panels: white in Light, the menu navy in Dark (was a
  lighter #1d3350). The only other `--navy-*` background is the reset.css
  body, which both themes override. Checked open with sample warning /
  expired items in both themes.

### v593 — background no longer bands dark / light while scrolling (2026-11-03)
Jack: "when I scroll down it changes between the dark and white but only
in the background ... it is currently broken up", and the Light wave
"slightly darker". Cause: ocean.jpg is a bright breaking wave over a
near-black bottom third; `cover` on the fixed layer laid that black band
across the lower screen, so the gaps between scrolling panels flicked
between foam and black (worst in Light). Fix (theme-bridge.css, app
pages): photo anchored `center top`, lower part faded out with a
`mask-image` gradient (solid to 40%, gone by 92%), filter via
`--seav-ocean-filter`. Light: opacity 0.16 -> 0.24, filter
`saturate(0.9) contrast(0.8)` so foam is not white patches. Public
profile `.ocean` gets the same anchor + fade; light palettes 0.14 -> 0.22
with the same softening. Checked on a lengthened dashboard harness at
top / middle / bottom in both themes, 375px phone in Light, and the real
public profile scrolled 1800px in Pearl Grey and Sea-V Original.

### v592 — public profile in the new style, with five crew palettes (2026-11-03)
Jack: the public profile "is the old style ... match the current new style,
and have options for colors ... like a personalised cv". Approved from a
live preview of all five ("Yes, build all five").
- **Look** (`css/pages/public-profile-themes.css`, imported after
  theme-light.css, gated on `html:has(> body.public-profile-page)`): the
  frosted ladder (`--pp-depth-*`, `--pp-glass-*`) and the glass tokens
  become solid palette surfaces, no blur, no card shadows, faint ocean +
  pp-wave, accent on icons / snapshot edges / Download CV.
  `generate-bridge-corners.mjs` now covers public-profile.css too (scope
  gained `body.public-profile-page`; 320 selectors) — the themes file
  defines `--bridge-radius: 4px` there. **This reverses the v551 frosted
  glass and the "public profile deliberately NOT in scope" note in v583.**
- **Palettes** = the CV generator's names: seav (default) / ocean-blue /
  night-watch (dark), simple-green / pearl-grey (light — ink flips via
  `--ppt-ink`, secondary-text alphas raised). `<html data-pp-theme>` is set
  by `applyPublicTheme()` in public-profile.js; unknown -> seav.
- **DB, LIVE** (`docs/schema-profile-public-theme.sql`, applied in v591):
  `profile.public_theme` text not null default 'seav' + check of the five
  ids; `get_public_profile` DROP + CREATE with the extra column, PUBLIC
  execute revoked and the exact old ACL restored (anon / authenticated /
  service_role). No direct anon column grant — the RPC is the only public
  path. Smoke test: old RPC fields byte-identical, private fields absent,
  anon table read 401, write -> anon sees it -> 'hot-pink' rejected by the
  check -> reverted, 15/15 rows default, advisors 23 -> 23.
  `testPublicThemeRpc` added to test-supabase step 1 (passes).
- **Picker**: Profile settings -> Public profile panel (expanded) ->
  "Colours on your public profile", five radio swatches (keyboard
  arrows, focus ring). Saved on its own by `SeavAPI.savePublicTheme`
  (single-column update + `SeavState.updateProfile`), outside
  #profileForm so keep() is never involved. `mapProfileToSupabase` only
  sends public_theme when supplied, so partial saves never reset it.
  `public_theme` added to OWNER_PROFILE_COLUMNS. Verified: the real
  `initPublicTheme` against stubs (sync, save, failed save reverts +
  error toast); the picker on a profile.html harness in both themes.
- **Contrast**: a 4.5:1 sweep of the real public profile (live anon data,
  all details open) in every palette is clean. Found + fixed on the way:
  `reset.css` body text was `var(--white)` (the one literal white token)
  -> ink; pastel status text (valid-pill mint, gold labels, amber /
  orange / coral icons) gets darker equivalents in EVERY light look —
  app Light and the light palettes share one rule in theme-light.css
  (`--light-status-*`); app Light secondary text raised to match.
- Dark app pages re-diffed against the pre-conversion copy: only the new
  switch + the ocean differ.
- Phone: Pearl Grey at 375px, no sideways scroll (other palettes share
  the layout). Not done: the share card (seav-share.js) does not follow
  the palette; the Download CV button is still the v542 placeholder toast.

### v586–v587 — dead code removed (Jack: "review all dead code")
Two read-only audits (JS/HTML, CSS), then removal. Already in v586 (Jack
committed mid-way): `js/navigation-routing.js` deleted (no caller since v530)
and its tags on navigation / public profile; dashboard's duplicate topojson /
ports / helpers / passage / routing tags — cause was patch-html-scripts.mjs
re-inserting the block because it tested for navigation-passage.js, now keyed
on navigation-helpers.js; core.js `renderPublicTopbar` (no page uses
data-topbar="public"), the sidebar-achievements / dashboard-in-progress
renderers and their listeners (their mounts exist on no page).
**Bug fixed on the way:** topbar Search never listed PAGES since v565 — it
read `#sidebarMount a.dash-link`, which is empty; now `#topbarMenuPanel`.
**DB, LIVE:** `profile.schengen_stays` dropped
(`docs/schema-drop-profile-schengen-stays.sql`; 0/15 rows held data; owner
read + anon public profile checked, advisors 23/23), schengen probe removed
from test-supabase.
v587: 20 unused JS helpers (`getEmpty*Entry` x12, `computeMasterSeaService`,
`getVesselHistory`/`getCurrentVesselIndex`, `renderMandatoryCertDetailHtml`,
`listBadges`, `buildHobbyRow`, `getCountryByName`, `buildVesselHighlights`);
the always-hidden old `.dashboard-shell-head` on public-profile.html and the
JS that filled it; 268 CSS selectors (225 whole rules, ~1,800 lines across
24 sheets) whose class names appear in no .html / js / edge function — a
selector is only cut when it REQUIRES such a class (`:not()` args never
count; dead args inside `:is()/:where()` are pruned, the rest kept; names
built at runtime like `pp-snap--${}` are protected by a prefix check);
33 unused tokens in variables.css; corners regenerated (320 -> 296).
Kept on purpose: `#sidebarMount` divs (they gate wireLogout /
wireSidebarPublicProfile), `wireDragDrop`, navigation-passage.js,
img/hero.jpg and img/logo-email.png (may be used by Supabase email
templates — check the dashboard before deleting). Public profile checked
locally with live data after the cut.

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

9. **Rest of the 2026-09-26 audit — re-checked 2026-11-03 (v590).**
   Fixed: storage path-planting + email rate limit (v579), dead routing
   script (v586), Master Unlimited pre-cert days (v572), end-date counting
   (v571), muted contrast (v539), payslip currencies, overlapping
   contracts, navigation_areas / tenders anon column scope (all v590).
   Not a bug: yard uncapped on the 36 months (MSN 1858). Standby: kept
   per entry + form note (see v590). CSP narrowed + scripts pinned
   with SRI (v590; unsafe-eval kept for heic2any, unsafe-inline until the
   inline scripts move to files). Focus rings + modal focus
   handling (v590). **Still open:** typography.css forces 14px
   so `--font-label` 11px can never apply (fold into the redesign).

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
