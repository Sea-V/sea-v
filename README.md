# SEA-V

Maritime career platform for yacht crew — profile, sea time, certificates, achievements, CV generator, and public profile view.

Phase 2 uses **Supabase Auth** — each user has their own profile, documents, and Row Level Security.

## Quick start

1. Serve the folder locally (required for Supabase and relative asset paths):

   ```bash
   python3 -m http.server 8765
   ```

   Then open [http://localhost:8765/index.html](http://localhost:8765/index.html).

## Supabase setup

1. Run **`docs/schema-full.sql`** (tables + buckets)
2. Enable **Email** auth in Supabase Dashboard
3. Run **`docs/schema-phase2.sql`** (per-user RLS + private storage)
4. Run **`docs/schema-phase2-public-hardening.sql`** (public profile privacy + storage lock-down)
5. Optional: **`docs/certificate-catalog.sql`** (certificate dropdown catalog in DB)
6. Optional: **`docs/schema-reference-verification.sql`** + deploy Edge Function with `RESEND_API_KEY`
7. Optional: **`docs/schema-account-deletion.sql`** (self-service delete account)
8. Verify: `node scripts/test-supabase.mjs --step all`

Guides: **[docs/SUPABASE-PHASE2.md](docs/SUPABASE-PHASE2.md)** · **[docs/SECURITY.md](docs/SECURITY.md)**

## Testing

```bash
python3 -m http.server 8765   # terminal 1
npm test                      # terminal 2 (site + Supabase smoke tests)
```

Manual walkthrough: **[docs/TEST-PLAN.md](docs/TEST-PLAN.md)**

## Logo

Brand mark lives at **`img/logo.png`**. Replace that file to use your own logo (keep the same path, or update references in `js/core.js`, `js/cv-engine.js`, and the public HTML pages).

## Project layout

| Path | Purpose |
|------|---------|
| `*.html` | Page entry points |
| `js/` | App logic — split modules: `api-core.js`, `certificates-*.js`, `navigation-*.js`, `dashboard-snippets.js`, `public-profile-*.js`, `seav-config.js`, `seav-upload.js` |
| `css/` | Styles (core, components, pages, responsive) |
| `img/badges/` | Achievement badge SVGs |
| `docs/` | Supabase setup SQL and Phase 1 guide |
| `scripts/` | Dev utilities (`test-supabase.mjs`, `generate-badges.mjs`) |

## Auth & security

- **Login / signup:** Supabase Auth (`js/auth.js`)
- **Documents:** stored under `{user_id}/…` in private buckets (after Phase 2 SQL)
- **Public profile:** opt-in link `public-profile.html?p={user-id}`
- **Liability & GDPR:** read **`docs/SECURITY.md`** (not legal advice)

## Deploy

Connect repo to **Netlify** (or similar) — publish directory `.` — see **`netlify.toml`**. Set Supabase **Site URL** to your live domain.

## Pages

- **Public:** `index.html`, `signup.html`, `about.html`, `contact.html`
- **App:** dashboard, profile, vessels, sea time, certificates, references, achievements, tenders, navigation map, onboard experience, hobbies, specialist qualifications, payslips
- **Tools:** `cv-generator.html`, `public-profile.html`
