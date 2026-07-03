# Reference email verification

Captains and senior officers verify references via a secure email link — no SEA-V login required.

## Architecture

1. **Crew** saves a reference with the referee’s email and clicks **Share link** on References.
2. **`request_reference_verification` RPC** creates a single-use token (SHA-256 hash stored), sets status to `Sent for Verification`, returns a verify URL.
3. **Crew** copies the suggested email and sends it from their **personal email** (recommended). Optional: Edge Function + Resend for automated email (`REFERENCE_VERIFICATION_USE_EDGE_EMAIL: true`).
4. **Referee** opens `verify-reference.html?token=…`, reviews the reference, draws a signature, confirms or declines.
5. **`complete_reference_verification_v3` RPC** (or v2) writes `verification` JSON + status. Verified references appear on the public profile automatically.

## Setup

### 1. Run SQL in Supabase

In **Supabase → SQL Editor**, run:

```
docs/schema-reference-verification.sql
docs/schema-reference-verification-v2-complete.sql
docs/schema-reference-verification-attachment.sql
docs/schema-reference-verification-signature.sql
```

Optional — set production site URL for links:

```sql
alter database postgres set app.settings.site_url = 'https://www.sea-v.com';
```

### 2. Deploy Edge Function (production email)

Install [Supabase CLI](https://supabase.com/docs/guides/cli), then from the repo root:

```bash
supabase login
supabase link --project-ref bnjtrwmwyulvmsautssd
supabase secrets set \
  RESEND_API_KEY=re_xxxx \
  REFERENCE_VERIFY_FROM_EMAIL="SEA-V <verify@sea-v.com>"
supabase functions deploy reference-verification
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically for Edge Functions.

Verify domain in Resend before sending from your `@sea-v.com` address.

### 3. Frontend config

`js/seav-config.js` already points at:

```
https://bnjtrwmwyulvmsautssd.supabase.co/functions/v1/reference-verification
```

On **localhost**, the app skips the Edge Function and calls the RPC directly (`SHOW_DEV_VERIFY_LINK: true`).

## Test locally (no email)

**Important:** Local dev still uses your **live Supabase database** — not offline storage. Vessels and profile data only load after you **sign in on localhost** with the same account as `www.sea-v.com`. Sessions do not carry over between domains.

1. Run the SQL migration in Supabase (step 1 above).
2. Start the server: `python3 -m http.server 8765`
3. Open **http://localhost:8765/index.html** (not a `file://` path) and log in.
4. **References** → add a reference with a **referee email** (not your own).
5. Click **Send email** — a dialog shows the verify link when email is not configured.
6. Open that link in incognito → complete as the referee.
7. Refresh References — status should be **Verified** (or **Declined**).

**Easier option:** test on **https://www.sea-v.com** where your data already exists (after SQL + optional Edge Function deploy).

## Test on production (with email)

1. Complete steps 1–2 above with Resend configured.
2. Deploy site to Vercel (push to `main`).
3. Send verification from www.sea-v.com.
4. Referee receives email → completes `verify-reference.html`.

## Security notes

- Plain tokens are never stored; only SHA-256 hashes.
- Tokens expire after **14 days** and are **single-use**.
- Referee email cannot match the crew member’s profile email.
- Crew cannot manually set status to Verified (removed from UI).
- Token table has RLS enabled with **no client policies** — only security definer RPCs.

## Files

| File | Purpose |
|------|---------|
| `docs/schema-reference-verification.sql` | Table + RPCs |
| `supabase/functions/reference-verification/` | Resend email sender |
| `js/reference-verification.js` | Client API |
| `verify-reference.html` + `js/verify-reference.js` | Public referee page |
| `docs/schema-reference-verification-signature.sql` | Drawn signature upload + complete v3 |
| `js/seav-signature-pad.js` | Reusable canvas signature pad |
