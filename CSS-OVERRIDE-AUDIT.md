# CSS `!important` Override Audit

134 `!important` declarations across 16 CSS files. Grouped below by what they're actually for. Each group is marked:

- ✅ **Safe** — a deliberate, narrow, well-understood override (fighting a browser default, a third-party library, or print output). No action needed.
- ⚠️ **Risk** — a broad rule that reaches across pages/components via a body-class selector. This is the exact pattern that caused the About-page topbar bug: it silently wins or loses depending on CSS `@import` order, not just specificity, so it can misfire again if a shared component ever gets reused under a different body class.

---

## 1. `core/typography.css` — 16 declarations ⚠️ **highest risk area**

**What it does:** A "one body size" system. Three blanket rules key off body class (`body.app-page`, `body.public-profile-page`, `body.landing-page`, plus `.index-page`/`.signup-page` for the caps-removal rule) and force `font-size`, `font-family`, `font-weight`, `line-height`, `text-transform`, and `letter-spacing` on huge lists of elements/classes (`p`, `span`, `a`, `button`, `.dash-card h3`, `.public-cv-fact-label`, etc.), specifically to **override page-specific CSS** that set their own smaller/inconsistent sizes. The file's own comment says as much: *"overrides scattered 11–13px rules in page CSS."*

- Lines 56–57: strip `text-transform`/`letter-spacing` on every element under 5 body classes (kills any accidental ALL-CAPS from browser defaults or old CSS).
- Lines 69–72: force page-title sizing (`.info-title`, `.info-shell-head h1/h2`) to 18px/800/1.25 regardless of what the page's own CSS says.
- Lines 152–153: the big one — forces `font-size: 14px` on ~50 different tags/classes across `app-page`/`public-profile-page`/`landing-page`. **Just patched** with a `:not(.legal-topbar *, .legal-footer *)` exclusion so shared chrome components aren't caught in it (see below).
- Lines 173–175: re-exempts status pills from the above (pills need to stay small — this un-does line 153 specifically for `.pill`, `.status-pill`, etc.).
- Lines 188–191: same blanket treatment for `h3`–`h6`/card headings.

**Why it's risk, not just safe-but-ugly:** this file is `@import`ed *last* among the page CSS files (after `legal.css`, `info.css`, etc., but before `responsive/mobile.css`), so on a specificity tie it wins by source order — which is exactly what silently broke the About topbar. Any other shared component (footer, modal, card) reused across two different body classes could hit the same bug if its own CSS doesn't happen to win on raw specificity.

**Recommendation:** no immediate fix needed elsewhere — I only found this actually misfiring in one place (now fixed). But if a future shared component looks "slightly off" only on one page, check here first before adding a local `!important`.

---

## 2. `components/logo-sizing.css` — 19 declarations ✅ Safe, deliberately loaded last

**What it does:** Pins every logo image on the site to an exact pixel size (`.info-logo` 95px, `.legal-brand img` 16px, `.verify-reference-logo` 27px, `.app-topbar .brand img` 34px, `.cv-brand-mark` 7.5mm, etc.), including two responsive breakpoints that shrink some of them further.

**Why `!important`:** the file header explains it — *"loaded last; use px literals (not vw caps)"*. This is a deliberate final-word safety net so that if any page CSS or a stale cached `@import` ever sets a logo to the wrong size, this file always wins and the logo renders correctly. This is the opposite of risky: it's specifically there to prevent the class of bug in section 1.

---

## 3. `components/topbar.css` — 4 declarations ✅ Safe, documented

- Lines 10–14: `.app-topbar .topbar-inner { min-height: 0 !important; ... }` — explicit comment: *"Override generic layout min-height so the bar fits the logo, not vice versa."*
- Lines 58–60: pins the app/public topbar logo to 34px — duplicate safety net alongside logo-sizing.css for the same element.

---

## 4. `components/pills.css` — 3 declarations ✅ Safe

`.list-row, .kpi-box { border-radius: 16px !important; border: ... !important; background: ... !important; }` — forces consistent card styling for these two components regardless of whichever page-specific CSS they're dropped into. Narrow, two-selector scope, low risk.

---

## 5. `components/modals.css` — 11 declarations ✅ Safe (browser-default fighting)

- Lines 516–519: the standard Chrome autofill hack (`-webkit-text-fill-color`, `-webkit-box-shadow: 0 0 0 1000px ... inset`). This *must* be `!important` — Chrome's autofill yellow background is applied by the browser itself at a priority normal CSS can't beat any other way.
- Lines 556, 563–568: `.modal-check` (checkbox label) — forces flex layout, color, size, weight, and un-caps text regardless of context.
- Lines 768–769: strips caps/letter-spacing on modal form fields.

---

## 6. `components/layout.css` (core) — 4 declarations ✅ Safe

- Lines 10–12: `.app-topbar` reset (transparent background/border/shadow) — same "fit the logo" pattern as topbar.css.
- Line 580: `.sidebar-badge-panel, .sidebar-badge-grid, .sidebar-badge-item { overflow: visible !important; }` — stops an ancestor's `overflow: hidden` from clipping badge tooltips/popovers.
- Line 1392 (mobile breakpoint): `height: auto !important` on a responsive image variant.

---

## 7. `core/reset.css` — 1 declaration ✅ Safe, standard practice

`[hidden] { display: none !important; }` — ensures the HTML `hidden` attribute always wins over any `display` rule, anywhere. This is a widely-used defensive default (the browser's own native rule for `[hidden]` is very easy to accidentally out-cascade otherwise).

---

## 8. `pages/dashboard.css` — 12 declarations ✅ Safe, scoped

All 12 live in one block: `.dashboard-shell-card ... .tender-proficiency-pill { ... }` — forces layout/color/sizing for the tender-proficiency pill specifically when nested inside a compact dashboard card, overriding the generic pill rule for that one context. Plus one `height: auto !important` in a mobile breakpoint. Narrow, single-selector-chain scope.

---

## 9. `pages/verify-reference.css` — 25 declarations ⚠️ Same pattern as the About bug, currently untriggered

This file leans on the identical technique that broke About: page-scoped selectors (`.verify-reference-page .modal-check`, `.verify-reference-page a.reference-modern-attachment...`) with `!important` stacked on top, to override the generic `.modal-check` / link styling from `modals.css` and `typography.css`.

It currently works because `verify-reference.html` uses its own dedicated body classes (`landing-page verify-reference-page`) and nothing else currently shares `.verify-reference-attachment-open` or this exact `.modal-check` combination elsewhere. But it's the same fragile shape: if this page's body classes ever change, or if any of these class names get reused on another page, this could silently win or lose the same way the topbar did. Not broken today — just worth knowing it's built the same way.

---

## 10. `pages/index.css` — 6 declarations ⚠️ Possibly redundant with #2

`body.index-page .container > .logo, body.signup-page .container > .logo, img.seav-logo--auth { width: 120px !important; ... }` (plus a mobile breakpoint at 95px). This pins the same auth-page logo that `logo-sizing.css` already has a documented "load last" job for. Two different files independently forcing the same element's size with `!important` isn't broken (whichever loads later wins, and they don't disagree), but it's duplicate logic — worth consolidating into `logo-sizing.css` at some point so there's one source of truth for logo sizing instead of two.

---

## 11. `pages/public-profile.css` — 6 declarations ✅ Safe (mostly library-fighting)

- Lines 140–141: forces white text + bold weight on a pill-style badge regardless of inherited link color.
- Lines 280–282: `.leaflet-container { width: 100% !important; height: 380px !important; ... }` — overriding the Leaflet map library's own inline styles, which is standard practice for that library (Leaflet sets dimensions via JS/inline style, so plain CSS can't win without `!important`).
- Line 479: `[hidden]`-style show/hide toggle for a "more" block.

---

## 12. `pages/navigation.css` — 4 declarations ✅ Safe (library-fighting)

- Line 281: forces crosshair cursor while picking a location on the Leaflet map — needs to beat Leaflet's own cursor styling.
- Lines 451–454: same Chrome autofill hack as modals.css, duplicated here for the navigation form's inputs.

---

## 13. `pages/seatime.css` — 2 declarations ✅ Safe

`.seatime-empty-row td { padding: 0 !important; border-bottom: 0 !important; }` — collapses a table row's default padding/border for the empty-state row. Narrow.

---

## 14. `pages/certificates.css` — 2 declarations ✅ Safe, documented

`.cert-card .pill { align-self: flex-start !important; flex: 0 0 auto !important; }` — explicitly commented *"Legacy alias — sizing comes from css/components/pills.css"*, i.e. a small shim so an older selector doesn't fight the shared pill component's own sizing.

---

## 15. `pages/cv-generator.css` — 18 declarations ✅ Safe (print output + fixed document styling)

- Several `letter-spacing`/`text-transform: uppercase !important` pairs on the CV document's name/rank/section-title text — deliberate: the CV template should always render this way regardless of any page context it's embedded in.
- The rest is a `@media print` block that hides all app chrome (topbar, sidebar, editor, footer) and resets the CV shell to a plain white page when the user hits "Save as PDF" — standard print-stylesheet practice, needs `!important` to reliably beat screen styles when printing.

---

## 16. `pages/legal.css` — 1 declaration ✅ Safe

`.legal-topnav-cta { color: #fff !important; }` — forces white text on the "Sign in" gradient pill regardless of the base link color it would otherwise inherit from `.legal-topnav a`. One-off, narrow, no conflict potential.

---

## Bottom line

Most of this is legitimate, narrow, and safe — browser-default fighting (autofill, Leaflet), print output, or single-component overrides. The one **systemic** risk is `core/typography.css`'s blanket body-class rules (section 1), which is what caused the About topbar bug — that's now patched with a proper exclusion rather than a competing override. `pages/verify-reference.css` (section 9) is built the same fragile way but isn't currently misfiring; worth a mental note if that page's markup ever changes. `pages/index.css` (section 10) duplicates work `logo-sizing.css` already does and could be consolidated, but isn't causing any bug today.
