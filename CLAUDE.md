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
- Commits: `vNNN: short description`. Currently at **v479**. Increment every commit.
- Schema changes: write a new `docs/schema-*.sql`, apply it, commit it. Never
  edit an old migration file.
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

## Current state (2026-08-15)
- HEAD = v480 "shorten CV template picker labels to colour names only".
- The Resend diagnostic logging is now committed (1afa3c4) but **still not
  deployed** — the live edge function is version 5 and has none of it, so the
  "email failed" report remains undiagnosed. It logs `refereeEmail` in plain
  text (crew PII); strip it once root-caused.
- **Uncommitted:** seatime alignment/typography fixes (`css/pages/seatime.css`,
  `css/core/variables.css`, `seatime.html`) — see thread 2 below.

## Open threads
1. Referee email failing. Next step: deploy the diagnostic, send one test
   reference, read the function logs, then remove the logging.
2. Seatime page spacing/alignment pass. Done so far: single 28px gutter across
   the KPI band (was 18px, so Service summary + TRB/OOW panels sat out of
   line); the KPI caveat line moved off borrowed `public-profile` classes onto
   `.seatime-shell-card .seatime-kpi-caveat` using `--font-label` and the new
   `--seav-note-color`. Not yet committed, not yet checked in a browser beyond
   the user's screenshots. Remaining: `seatime.css` still holds ~125 hardcoded
   px values that predate the token scale.

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
