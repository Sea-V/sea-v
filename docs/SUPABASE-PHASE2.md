# Supabase Phase 2 — Auth & per-user security

Phase 2 replaces the demo session with **Supabase Auth** and **per-user Row Level Security**.

## 1. Enable authentication

In **Supabase Dashboard → Authentication**:

### Providers → Email
1. Enable **Email**
2. For local dev, you can **disable “Confirm email”** to skip the inbox step
3. For production, keep confirm on and complete the URL steps below

### URL Configuration (required for email links)
Add **exactly** the URL you use in the browser:

| Setting | Local dev example |
|---------|-------------------|
| **Site URL** | `http://localhost:8765` |
| **Redirect URLs** | `http://localhost:8765/index.html` |
| | `http://localhost:8765/**` |

Use `http://127.0.0.1:8765/...` instead if that’s what you open — they must match.

After clicking the email link, you should land on **`index.html`** and be signed in automatically.

### “Safari can’t connect” when clicking the confirm link

The email link sends you back to **`http://localhost:8765`** (or whatever URL you used when signing up). That only works if **all** of these are true:

1. Your local server is running: `python3 -m http.server 8765`
2. You open the link on the **same computer** (not iPhone/iPad Mail — `localhost` on a phone is the phone, not your Mac)
3. Supabase **Redirect URLs** include that exact origin (`localhost` vs `127.0.0.1` must match what you use in the browser)

**Fastest fixes while developing:**

| Option | What to do |
|--------|------------|
| Skip email confirm | Supabase → Authentication → Providers → Email → turn **off** “Confirm email”, then log in normally |
| Confirm manually | Supabase → Authentication → Users → your user → confirm the email / mark verified |
| Make the link work | Start the server, open the confirm link on your Mac in Safari (copy link from Mail if needed) |

When you deploy (e.g. Netlify), set **Site URL** and **Redirect URLs** to your live domain (e.g. `https://your-site.netlify.app/index.html`) and sign up from that URL so confirmation emails use a public link.

### Email not arriving?
- Check spam / promotions
- Supabase **Authentication → Logs** for send errors
- Free tier: limited emails per hour
- Use **Resend confirmation email** on the signup page

## 2. Run SQL migrations (order matters)

**Plain English guide:** read **`docs/SQL-SETUP-GUIDE.md`** first — it explains what each file does and what to name them in the SQL Editor.

| Step | File | Save as in Supabase |
|------|------|---------------------|
| 1 | `docs/schema-full.sql` | `1 - Create all tables` |
| 2 | `docs/schema-phase2.sql` | `2 - Auth and per-user security` |
| 3 (if needed) | `docs/schema-phase2-auth-trigger.sql` | `3 - Fix signup profile` |
| 4 (if needed) | `docs/schema-phase2-storage-public-photos.sql` | `4 - Public profile files` |

The trigger creates each user’s `profile` row automatically when they sign up (avoids RLS blocking the first insert from the browser).

**Uploaded files (photos, PDFs, certificates, etc.):** Phase 2 storage buckets are private. The app resolves **signed URLs** when loading data. Re-upload any files that still don’t appear after a hard refresh (older rows may only have broken public URLs).

## 3. Migrate existing demo data (optional)

If you used `default-profile` in Phase 1:

1. Sign up in the app with your real account
2. Copy your new user UUID from **Authentication → Users**
3. Uncomment and run the migration block at the top of `schema-phase2.sql`, replacing `YOUR-AUTH-USER-UUID`

## 4. App behaviour after Phase 2

| Feature | Behaviour |
|---------|-----------|
| Login | `signInWithPassword` |
| Sign up | `signUp` + profile row (`id` = auth user id) |
| App pages | Require Supabase session |
| Public profile | `public-profile.html?p={user-uuid}` when `public_enabled` |
| Uploads | Stored under `{user_id}/{entity_id}/filename` |
| Payslips | Owner-only; never on public profile |

## 5. Verify

```bash
node scripts/test-supabase.mjs
```

Then manually:

1. Sign up with a new email
2. Save profile — confirm row in Supabase `profile` with your `user_id`
3. Incognito: open dashboard → should redirect to login
4. Enable public profile → copy link → open in incognito

## 6. Security documentation

Read **`docs/SECURITY.md`** for document storage, liability, and go-live checklist.
