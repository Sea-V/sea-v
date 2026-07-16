# SEA-V — Full Accounts &amp; Setup Guide

Master reference for every account, service, and credential behind SEA-V. Keep this file up to date whenever a new service, account, or key is added.

**On passwords:** the password columns below are intentionally left blank. Fill them in yourself, directly in this file (or better, in a password manager and just link to the entry here) — never paste a password into a chat with an AI assistant, including me. I don't know any of your actual passwords or API key values; I only know account names, emails, and what each service is used for.

Last updated: 2026-07-12

---

## 1. Domain

| Item | Value |
|---|---|
| Domain | `sea-v.com` |
| Registrar / DNS | Cloudflare |
| DNS records in use | A/CNAME for the site, plus Resend's DKIM, SPF (TXT), and MX records for `sea-v.com` (auto-configured via Resend's Cloudflare integration) |
| Login | admin@sea-v.com |
| Password | _(fill in)_ |
| 2FA | _(fill in — recommend enabling if not already)_ |

---

## 2. Email addresses

| Address | Purpose |
|---|---|
| `admin@sea-v.com` | Primary admin/owner address — used to log into Resend, Cloudflare, and likely GitHub/Supabase/hosting. Also the site's general contact address. |
| `noreply@sea-v.com` | Automated sender address for Supabase auth emails (signup confirmation, etc.), sent via Resend SMTP. Not a monitored inbox. |

| Item | Value |
|---|---|
| Where these inboxes actually live (Google Workspace, Cloudflare Email Routing, other) | _(fill in — I don't have visibility into this)_ |
| Login | _(fill in)_ |
| Password | _(fill in)_ |
| 2FA / recovery | _(fill in)_ |

---

## 3. GitHub

| Item | Value |
|---|---|
| Repo | `Sea-V/sea-v` |
| Branches | `main` (active development — this is what should be deployed), `Sea-v-main` (stale legacy branch, do not deploy from this) |
| Account / org login | _(fill in)_ |
| Password | _(fill in)_ |
| 2FA | _(fill in)_ |
| Access method used day-to-day | Cursor (connected directly to this repo) |

---

## 4. Supabase (database, auth, storage)

| Item | Value |
|---|---|
| Project name | `sea-v` |
| Project ref | `bnjtrwmwyulvmsautssd` |
| Region | eu-west-2 |
| Dashboard URL | `https://supabase.com/dashboard/project/bnjtrwmwyulvmsautssd` |
| Account login | _(fill in — likely admin@sea-v.com)_ |
| Password | _(fill in)_ |
| 2FA | _(fill in)_ |
| Plan | _(fill in — Free/Pro/etc.)_ |
| What it's used for | Postgres database, authentication, file storage (all buckets), Row Level Security for every user-owned table |

---

## 5. Resend (transactional email / SMTP)

| Item | Value |
|---|---|
| Account login | admin@sea-v.com |
| Password | _(fill in)_ |
| 2FA | _(fill in)_ |
| Domain configured | `sea-v.com` — **Verified** |
| Sending region | North Virginia (us-east-1) |
| API key name (in Supabase SMTP) | `SEA-V Supabase SMTP` — "Sending access" permission only (not full access) |
| API key value | Stored only in Supabase's encrypted SMTP settings — not recoverable from Resend once the creation dialog was closed. If it ever needs replacing, generate a new key in Resend → API keys and re-paste into Supabase → Authentication → Emails → SMTP Settings → Password. |
| What it's used for | Sends all Supabase auth emails (signup confirmation, and any future password reset / magic link emails) via custom SMTP — replaced Supabase's built-in mailer, which was capped at 2 emails/hour. |
| Rate limit now | 30 emails/hour (Supabase's "Rate limit for sending emails" setting, adjustable in Authentication → Rate Limits if launch traffic needs more) |

**SMTP settings currently saved in Supabase** (Authentication → Emails → SMTP Settings):

| Field | Value |
|---|---|
| Sender email | `noreply@sea-v.com` |
| Sender name | `SEA-V` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (this is always literally the word "resend" for every Resend customer — not account-specific) |
| Password | The Resend API key above |

---

## 6. Hosting / deploy

| Item | Value |
|---|---|
| Provider | Netlify (confirmed — no active Vercel project exists under the connected Vercel team, even though `vercel.json` is present in the repo as a leftover/alternative config) |
| Config file | `netlify.toml` (publish directory `.`, static site, no build step) |
| Branch deployed | `main` — **confirm this in the Netlify dashboard**; it was previously misconfigured to build from the stale `Sea-v-main` branch (fixed 2026-07-06), so it's worth a periodic check that it hasn't drifted back |
| Account login | _(fill in — likely admin@sea-v.com)_ |
| Password | _(fill in)_ |
| Live URL | `https://www.sea-v.com` |
| Site URL set in Supabase | `https://www.sea-v.com` (Authentication → URL Configuration) |

---

## 7. Cloudflare

| Item | Value |
|---|---|
| Used for | DNS for `sea-v.com` (and possibly proxying/CDN — confirm in dashboard) |
| Account login | admin@sea-v.com (used this to authorize Resend's auto-DNS-configuration) |
| Password | _(fill in)_ |
| 2FA | _(fill in)_ |

---

## 8. Anything not listed here

Services I don't have direct visibility into but that may exist — check and add if applicable:
- Google Search Console (README references submitting the sitemap for `www.sea-v.com` — worth adding if set up)
- Any analytics tool (Plausible, GA, etc.)
- Payment/billing processor, if SEA-V ever charges users
- Password manager itself (1Password, Bitwarden, etc.) — worth noting which one you use, so this file can just point to it instead of holding blanks

---

## How to keep this current

Whenever a new service gets connected (or a key gets rotated), add or update its row here with account name, purpose, and where the actual secret lives — but keep the password cells blank and fill them in yourself directly in the file.
