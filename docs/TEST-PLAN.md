# SEA-V test plan

Run automated checks first, then walk through the manual steps in your browser.

## 1. Automated checks

From the project root:

```bash
# Terminal 1 — local server
python3 -m http.server 8765

# Terminal 2 — checks
node scripts/test-site.mjs
node scripts/test-supabase.mjs
```

**Expected:** all table checks pass after running `docs/schema-full.sql` in Supabase.

---

## 2. Supabase setup (one time)

1. Open **Supabase → SQL Editor**
2. Paste and run **`docs/schema-full.sql`**
3. Re-run `node scripts/test-supabase.mjs`

---

## 3. Manual browser walkthrough

Open **http://localhost:8765/index.html**

| # | Test | Expected |
|---|------|----------|
| 1 | Login page | Your `logo.png` shows; demo notice visible |
| 2 | Login with any email/password | Redirects to dashboard |
| 3 | Open `dashboard.html` directly in a new incognito window | Redirects to login (session guard) |
| 4 | Dashboard | Sidebar loads; CV Generator link present |
| 5 | Profile → edit name → Save | Toast success; name persists after refresh |
| 6 | Profile → tick public → Copy public link | Clipboard has `public-profile.html` URL |
| 7 | View Public Profile | Opens public CV (or gate if not public) |
| 8 | Vessels → Add vessel | Saves and appears in list |
| 9 | Sea Time → Add entry | Saves; totals update |
| 10 | Certificates | Templates load; can add cert |
| 11 | Navigation → Add port | Map marker appears |
| 12 | Payslips → Add payslip + PDF | Upload succeeds |
| 13 | CV Generator | Preview renders with logo |
| 14 | Logout | Returns to login; app pages blocked again |

---

## 4. If something fails

| Symptom | Fix |
|---------|-----|
| Setup banner on dashboard | Run `docs/schema-full.sql` |
| Upload / RLS error | Re-run `docs/schema-full.sql` (storage policies) |
| Logo broken | Serve via `http://localhost` (not `file://`) |
| Table missing in smoke test | Run `docs/schema-full.sql` |
