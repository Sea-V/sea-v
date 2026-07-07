# SEA-V AI integration plan (saved for later)

Status: **Not implemented** — reference when ready to build.

## Goal

Add AI assistance for writing (CV, experience, references) and career clarity (certs, profile completeness), without auto-saving to the database or exposing API keys in the browser.

## Architecture

```
Browser (SEA-V pages)
  → js/ai-client.js (thin client, JWT from Supabase session)
  → Supabase Edge Function: ai-assist
  → LLM provider (API key in Edge Function secrets only)
  → structured JSON back to UI
  → user edits → normal SEA-V save flow
```

Same pattern as existing `supabase/functions/reference-verification`.

### New pieces (when built)

| Piece | Purpose |
|-------|---------|
| `supabase/functions/ai-assist/` | Router by `action`; auth, rate limit, prompts |
| `js/ai-client.js` | Shared frontend caller + loading/errors |
| `SeavConfig.AI_ASSIST_*` | Function URL + feature flag |
| Optional `ai_usage` table | Per-user request log and daily caps |

### Rules

- API keys **never** in client or `seav-config.js`
- Every request requires Supabase JWT
- Send minimal career data (no payslips, PDFs, signed URLs)
- Structured JSON output; validate before returning
- **Never** auto-write certs, dates, or sea time
- User must review and save; show disclaimer on drafts
- Rate limit (e.g. 30 requests/user/day)

---

## Phased rollout

### Phase 0 — Foundation

- Create `ai-assist` Edge Function (CORS/auth like reference-verification)
- Set `AI_API_KEY` in Supabase secrets
- Add `js/ai-client.js` + `AI_ASSIST_ENABLED: false` until ready
- Optional `docs/ai-usage.sql` for usage logging

**First feature:** `cv_summary` on CV generator only.

### Phase 1 — Writing assistants

| Action | Page | Input | Output |
|--------|------|-------|--------|
| `cv_summary` | CV generator | Profile, vessels, certs, rank | Summary + headline options |
| `cv_vessel_bullets` | CV generator | Vessel + onboard entries | Bullet points |
| `onboard_experience` | Onboard experience | Category, vessel, notes | Polished paragraph |
| `vessel_experience` | Vessels | Role, program, notes | Experience onboard text |
| `reference_email` | References | Referee, vessel, dates | Email subject + body |

**UX:** Button → loading → preview → Insert / Regenerate / Cancel. Badge “AI draft” until user edits.

### Phase 2 — Career intelligence

| Action | Page | Notes |
|--------|------|-------|
| `cert_gap_analysis` | Certificates / dashboard | Ground in `certificate-catalog` DB — do not invent cert names |
| `profile_completeness` | Dashboard | Rules first; LLM friendly “next steps” |
| `public_profile_pitch` | Profile | Short recruiter-facing blurb |

### Phase 3 — Optional later

- Cert PDF extract (upload → propose fields → user confirms)
- Career Q&A over own data (SQL/aggregate + LLM format)
- Role-specific CV variants (deck / interior / engineering)

---

## Example: CV summary flow

1. User clicks **Improve summary** on `cv-generator.html`
2. Client POSTs:

```http
POST /functions/v1/ai-assist
Authorization: Bearer <session JWT>

{
  "action": "cv_summary",
  "options": { "tone": "professional", "targetRole": "Chief Stew" }
}
```

3. Function validates user, builds prompt from `buildCvSource()`-style data (server or sanitized client snapshot)
4. Returns:

```json
{
  "ok": true,
  "result": {
    "summary": "...",
    "headline": "...",
    "alternatives": ["..."]
  },
  "disclaimer": "Draft only — review before use."
}
```

5. UI fills `draft.summary` in CV engine; user edits; existing `scheduleSave()` / export unchanged.

---

## CV generator integration (first build)

Existing hooks:

- `SeavCvEngine.buildCvSource(state)` — profile, vessels, certs, onboard, etc.
- `draft.summary`, `draft.headline` — local draft

Add:

- Button beside summary field
- `SeavAI.request('cv_summary', options)`
- Optional `draft.summaryAiAssisted: true` flag

---

## Suggested file layout

```
supabase/functions/ai-assist/
  index.ts
  prompts/cv-summary.ts
  schemas/cv-summary.json

js/
  ai-client.js
  ai-ui.js          (optional shared modal)

docs/
  ai-usage.sql      (optional)
```

---

## Build order

1. Week 1 — Phase 0 + `cv_summary`
2. Week 2 — `cv_vessel_bullets` + `onboard_experience`
3. Week 3 — `reference_email` + dashboard completeness
4. Week 4 — `cert_gap_analysis`
5. Later — PDF extract, Q&A, role variants

---

## Cost notes

- Start with small/fast model for drafts
- ~1–2k tokens in + ~300 out per CV summary
- Daily cap per user; monitor via function logs + `ai_usage`

---

## When starting implementation

1. Read `supabase/functions/reference-verification/index.ts` as template
2. Add secrets in Supabase Dashboard
3. Wire one button on `cv-generator.html`
4. Enable `AI_ASSIST_ENABLED` only after smoke test

Related: [README.md](../README.md) · [SECURITY.md](./SECURITY.md) · [REFERENCE-VERIFICATION.md](./REFERENCE-VERIFICATION.md)
