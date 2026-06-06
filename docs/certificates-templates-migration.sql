-- SEA-V certificate template alignment (optional — app also syncs on load)
-- Run in Supabase SQL Editor if you want DB rows updated immediately.

-- Demote legacy universal-mandatory flags (now rank/role, identity, or superseded BST rows)
UPDATE certificates
SET
  is_mandatory = false,
  is_template = true,
  updated_at = now()
WHERE upper(trim(code)) IN (
  'PASSPORT',
  'STCW A-II/1',
  'GMDSS',
  'STCW A-VI/4-1',
  'STCW A-VI/1',
  'STCW A-VI/6-1'
)
AND is_mandatory = true;

-- Ensure minimum mandatory rows stay mandatory
UPDATE certificates
SET
  is_mandatory = true,
  is_template = true,
  updated_at = now()
WHERE upper(trim(code)) IN (
  'ENG1',
  'PST',
  'FPFF',
  'EFA',
  'PSSR',
  'PSA'
);

-- Minimum mandatory templates (insert only if missing by code)
INSERT INTO certificates (id, code, name, expiry_date, status, is_mandatory, is_template, updated_at)
SELECT
  'cert_tpl_' || lower(replace(replace(code, ' ', '_'), '/', '_')),
  code,
  name,
  NULL,
  'Missing',
  true,
  true,
  now()
FROM (
  VALUES
    ('ENG1', 'ENG1 Medical Certificate'),
    ('PST', 'Personal Survival Techniques (PST)'),
    ('FPFF', 'Fire Prevention and Fire Fighting (FPFF)'),
    ('EFA', 'Elementary First Aid (EFA)'),
    ('PSSR', 'Personal Safety and Social Responsibilities (PSSR)'),
    ('PSA', 'Proficiency in Security Awareness (PSA)')
) AS tpl(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM certificates c WHERE upper(trim(c.code)) = upper(trim(tpl.code))
);

-- Recommended rank/role templates (insert only if missing by code)
INSERT INTO certificates (id, code, name, expiry_date, status, is_mandatory, is_template, updated_at)
SELECT
  'cert_tpl_' || lower(replace(replace(code, ' ', '_'), '/', '_')),
  code,
  name,
  NULL,
  'Missing',
  false,
  true,
  now()
FROM (
  VALUES
    ('PASSPORT', 'Passport / Seafarer ID'),
    ('STCW A-II/1', 'Certificate of Competency (CoC)'),
    ('GMDSS', 'GMDSS General Operator Certificate'),
    ('STCW A-VI/6-2', 'Proficiency in Designated Security Duties (PDSD)'),
    ('STCW A-VI/4-1', 'Medical First Aid'),
    ('STCW A-VI/3', 'Advanced Fire Fighting'),
    ('STCW A-VI/2', 'Proficiency in Survival Craft & Rescue Boats')
) AS tpl(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM certificates c WHERE upper(trim(c.code)) = upper(trim(tpl.code))
);
