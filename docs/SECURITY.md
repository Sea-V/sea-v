# SEA-V — Security & document storage

**This is product/security guidance, not legal advice.** For liability, privacy law, and contracts, speak to a qualified lawyer in your jurisdiction (UK/EU recommended if you serve crew internationally).

---

## Short answer: are you protected by using Supabase?

**Partially — not fully.**

| Party | Role |
|-------|------|
| **You (SEA-V operator)** | **Data controller** — you decide why data is collected, who can access it, retention, and what you tell users |
| **Supabase** | **Infrastructure / sub-processor** — hosts Postgres, auth, and file storage with industry-standard security |

Supabase provides:

- Encryption in transit (TLS) and at rest
- SOC 2 Type 2 (check current status on [supabase.com/security](https://supabase.com/security))
- Row Level Security (RLS) and Auth — **but only if you configure them correctly**

Supabase does **not**:

- Write your privacy policy or terms
- Make you compliant with GDPR/UK GDPR automatically
- Stop you from misconfiguring public buckets or permissive RLS
- Take legal liability for how **your** app uses crew documents

**If documents leak because of your app config, you remain responsible** — same as using AWS or Azure.

---

## What you store (sensitivity)

| Data | Sensitivity |
|------|-------------|
| Payslips, passports, medical (ENG1), CoC scans | **High** — financial & identity |
| References, certificates, sea service | **Medium–high** |
| Profile photo, hobbies | **Lower** |
| Public profile (when enabled) | **Intentionally public** — user opt-in |

Payslips must **never** appear on the public profile (the app already excludes them). Keep `payslip-files` **private** with owner-only storage policies (Phase 2 SQL).

---

## Phase 1 vs Phase 2 (this repo)

| | Phase 1 (demo) | Phase 2 (production path) |
|--|------------------|---------------------------|
| Login | Demo session / shared profile | **Supabase Auth** (email + password) |
| Database | One shared `default-profile`, anon RLS | **`user_id` + owner RLS** |
| Storage | Public buckets, broad anon access | **Private buckets**, path `{user_id}/…` |
| Public CV | Toggle on shared profile | Per-user link `public-profile.html?p={uuid}` |

**Do not launch publicly on Phase 1 settings.**

---

## Your checklist before going live

1. Run **`docs/schema-phase2.sql`** after **`docs/schema-full.sql`**
2. Enable **Email** provider in Supabase → Authentication
3. Confirm **RLS enabled** on every table (Supabase Table Editor → RLS)
4. Confirm storage buckets are **private**; app uploads use `userId/entityId/file` paths
5. Publish a **Privacy Policy** and **Terms of Use** (what you collect, why, retention, deletion, contact)
6. Add a **cookie/storage notice** if required in your markets
7. Process **data subject requests** (access / delete) — Supabase lets you delete a user and cascade rows
8. Use **HTTPS only** in production (Netlify/Vercel provide this)
9. Never put the **service role key** in frontend code (only anon/publishable key)
10. Consider **Cyber insurance** and a UK/EU **legal review** if storing payslips at scale

---

## Document URLs & “public” buckets

If a storage bucket is marked **public**, anyone with the file URL can download it (URLs can be guessed or leaked). Phase 2 moves buckets to **private** and scopes uploads to the signed-in user’s folder.

For production hardening beyond Phase 2:

- Use **signed URLs** for downloads (especially payslips)
- Virus-scan uploads if accepting PDFs from many users
- Retention policy (delete old payslips after X years)

---

## GDPR / UK GDPR (if applicable)

If users are in the UK/EEA, you typically need:

- A **lawful basis** (usually contract or legitimate interest — lawyer confirms)
- Clear **privacy notice** at signup
- Ability to **export and delete** account data
- A **Data Processing Agreement** with Supabase (available on paid plans / enterprise)

Supabase’s DPA covers **their** processing; **you** remain responsible to your users.

---

## What to tell users (recommended)

On signup/profile, state clearly:

- What documents they upload and who can see them (only them; public profile is opt-in)
- That payslips are private
- How to delete their account
- Contact email for data requests

---

## Setup order

1. `docs/schema-full.sql`
2. Enable Supabase Auth (Email)
3. `docs/schema-phase2.sql`
4. Deploy static site (see `netlify.toml`)
5. Test with `node scripts/test-supabase.mjs` and manual login in incognito

See **`docs/SUPABASE-PHASE2.md`** for step-by-step Supabase dashboard tasks.
