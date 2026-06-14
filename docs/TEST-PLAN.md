# SEA-V test plan

Run automated checks first, then walk through the manual steps in your browser.

## 1. Automated checks

From the project root:

```bash
# Terminal 1 — local server
python3 -m http.server 8765

# Terminal 2 — checks
npm test
# or:
node scripts/test-site.mjs
node scripts/test-supabase.mjs --step all
```

**Expected:** all static file checks pass; Supabase security probes pass after Phase 2 + hardening SQL.

---

## 2. Supabase setup (one time)

1. Open **Supabase → SQL Editor**
2. Run **`docs/schema-full.sql`**, then **`docs/schema-phase2.sql`**, then **`docs/schema-phase2-public-hardening.sql`**
3. Run hardening steps in **`docs/hardening-steps/`** (steps 1–4)
4. Re-run `node scripts/test-supabase.mjs --step all`

---

## 3. Manual browser walkthrough

Open **http://localhost:8765/index.html**

| # | Test | Expected |
|---|------|----------|
| 1 | Login page | Logo shows; email/password fields present |
| 2 | Sign up with a new email | Confirmation email sent (or auto-login if confirm disabled) |
| 3 | Login with correct credentials | Redirects to dashboard |
| 4 | Open `dashboard.html` directly in incognito | Redirects to login (session guard) |
| 5 | Dashboard | Sidebar loads; CV Generator link present |
| 6 | Profile → edit name → Save | Toast success; name persists after refresh |
| 7 | Upload a certificate PDF | File stored in Supabase Storage (not base64 in DB) |
| 8 | Enable public profile → open public link | Public CV loads; email/phone not visible |
| 9 | Payslips page | Only visible when logged in as owner |
| 10 | Logout | Redirects to login; protected pages blocked |

---

## 4. Security regression checks

- `node scripts/test-supabase.mjs --step all` — anon writes blocked, column grants active, storage private
- Incognito: cannot read another user's private data via browser devtools + anon key
- Production: `ALLOW_DATAURL_FALLBACK` is false (uploads require Supabase)
