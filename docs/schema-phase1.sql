-- SEA-V Phase 1 reference schema (align with js/api.js)
-- Run only what you need in Supabase SQL Editor if tables differ.

-- Example profile row for single-user demo
INSERT INTO profile (id, name, public_enabled, updated_at)
VALUES ('default-profile', '', false, now())
ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at;

-- Migrate legacy profile id if you used an older build
UPDATE profile SET id = 'default-profile' WHERE id = 'profile_primary';

-- Public profile toggle (required for “Make my public profile visible”)
ALTER TABLE profile
ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false;
