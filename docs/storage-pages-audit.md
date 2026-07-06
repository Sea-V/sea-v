# Storage, SQL, and page save/load audit

Last reviewed: 2026-06-15. Use with `docs/hardening-steps/step5-storage-legacy-cleanup.sql` and `step5b-storage-legacy-paths-remaining.sql`.

## Why duplicates appeared

The `backfill_legacy_user_ids` migration assigned every `user_id IS NULL` row to the primary account. Phase 1 demo vessels/tenders (no photos, legacy paths) became visible alongside newer re-created records with the same names. **Not data loss** — stale rows resurfaced. DB currently holds 7 vessels and 5 tenders for Jack; hard refresh clears session cache (`seav_state_cache_v102_*`).

## Navigation passage colors

Passage track colors use `getVesselColor(vesselId)` in `js/navigation-helpers.js`. Previously colors were assigned by **alphabetical index** in the fleet list, so adding/removing duplicate vessels changed Senses from red to blue. Colors are now **stable per vessel ID** (hash-based).

## Bucket ↔ table ↔ page matrix

| Bucket | DB table / field | Save module | Load hydration |
|--------|------------------|-------------|----------------|
| `profile-photos` | `profile.photo` | `profile.js` | `state.js` background + profile page |
| `vessel-photos` | `vessels.photo` | `vessels.js` | `vessels.js` render, `dashboard-snippets.js`, `state.js` |
| `vessel-documents` | `vessels.sea_attachment` | `vessels.js` | `vessels.js` render, `state.js` |
| `seatime-files` | `seatimes.attachment` | `seatime.js` | `seatime.js`, `state.js` |
| `certificate-files` | `certificates.attachment` | `certificates.js` | `certificates.js`, `state.js` |
| `reference-files` | `sea_references.attachment` | `references.js` | `references.js`, `state.js` |
| `tender-photos` | `tenders.photo` | `tenders.js` | `tenders.js`, `dashboard-snippets.js`, `state.js` |
| `achievement-files` | `achievements.attachment` | achievements engine | `state.js` (deferred) |
| `onboard-experience-files` | `onboard_experiences.attachment` | `onboard-experience.js` | `onboard-experience.js`, `state.js` |
| `hobbies-interest-photos` | `hobbies_interests.photos[]` | `hobbies-interests.js` | `hobbies-interests.js`, `state.js` |
| `specialist-qualification-files` | `specialist_qualifications.attachment` | `specialist-qualifications.js` | same + `state.js` |
| `payslip-files` | `payslips.attachment` | `payslips-core.js` | same + `state.js` |

Upload path format (authenticated): `{userId}/{entityId}/{timestamp}-{filename}` via `SeavAuth.buildStoragePath`.

## Page checklist

| Page | Tables written | File fields | Pre-render hydration | SQL hardening |
|------|----------------|-------------|----------------------|---------------|
| `dashboard.html` | — | vessels, tenders, profile | `dashboard.js` awaits `hydrateStoredFiles` | step5 + 5b |
| `profile.html` | `profile` | `photo` | profile save/load | step5b profile |
| `vessels.html` | `vessels` | `photo`, `sea_attachment` | `renderVessels` hydrates | step5 + 5b vessel-documents |
| `seatime.html` | `seatimes` | `attachment` | `ensureSeatimeFilesHydrated` | step5 |
| `certificates.html` | `certificates` | `attachment` | `hydrateAttachment` on list | step5 |
| `references.html` | `sea_references` | `attachment` | `hydrateReferenceFiles` | step5b |
| `tenders.html` | `tenders` | `photo` | `hydrateTenderPhotos` | step5 |
| `navigation.html` | `navigation_areas` | waypoints JSON only | N/A | table RLS only |
| `onboard-experience.html` | `onboard_experiences` | `attachment` | `hydrateOnboardFiles` | step5 |
| `hobbies-interests.html` | `hobbies_interests` | `photos[]` | per-entry hydrate | step5 |
| `specialist-qualifications.html` | `specialist_qualifications` | `attachment` | list hydrate | step5b |
| `payslips.html` | `payslips` | `attachment` | list hydrate | step5b |
| `achievements.html` | `achievements` | `attachment` | via `state.js` if loaded | step5b |
| `cv-generator.html` | — | read-only | `state.js` partial keys | — |
| `public-profile.html` | — | public read policies | server/signed URLs | step4 public read |
| `verify-reference.html` | tokens + refs | `attachment` | verify flow | reference RLS |

## Storage RLS coverage

| Bucket | Step 3 owner prefix | Step 5 legacy path SELECT | Step 5b legacy path SELECT |
|--------|--------------------|---------------------------|----------------------------|
| `vessel-photos` | yes | yes | — |
| `vessel-documents` | yes | — | yes |
| `tender-photos` | yes | yes | — |
| `seatime-files` | yes | yes | — |
| `certificate-files` | yes | yes | — |
| `onboard-experience-files` | yes | yes | — |
| `hobbies-interest-photos` | yes | yes | — |
| `reference-files` | yes | — | yes |
| `achievement-files` | yes | — | yes |
| `specialist-qualification-files` | yes | — | yes |
| `payslip-files` | yes | — | yes |
| `profile-photos` | yes | — | yes |

Legacy paths do not start with `{userId}/` (e.g. `vessel_1779772960365_3ply7t/photo.jpg`). Owner SELECT must match `attachment->>'path'` on the user's row.

## Known gaps / actions

1. **HEIC photos — systemic fix shipped 2026-07-06.** `js/seav-upload.js`'s `uploadToStorage` (the single choke point every domain's file upload goes through) now detects HEIC/HEIF files and converts them to JPEG client-side via `heic2any` (CDN, loaded on every page that has file uploads) before storing. Fixes new uploads across every domain, not just tenders. **Still needed:** the 3 already-broken tender photos (Naiad, Axopar, Rafnar) were uploaded before this fix and are still stored as raw `.HEIC` — those specific files still need Jack to re-upload them once to get converted; the fix does not retroactively touch existing storage objects.
2. **Duplicate cleanup**: run `docs/dedupe-legacy-vessels.sql` preview if duplicates reappear; DB may already be clean.
3. **Session cache**: bump `CACHE_KEY_PREFIX` in `state.js` after fleet-affecting DB changes.
4. **Apply step5b** on Supabase if not yet applied (reference, payslip, profile legacy paths).

## Verification commands

```bash
node scripts/test-supabase.mjs --step 3   # buckets private, owner policies
node scripts/test-supabase.mjs --step 5   # legacy anon policies dropped
```

After deploy: hard refresh (Cmd+Shift+R) or sign out/in to clear stale cached vessel lists.
