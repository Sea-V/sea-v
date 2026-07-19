-- SEA-V yacht certificate catalog (reference data)
-- Run once in Supabase SQL Editor (Step 6 in docs/SQL-SETUP-GUIDE.md).
-- The certificates page loads this table when available; js/seav-data.js is the offline fallback.
-- Re-run to refresh seed rows after editing this file. Keep this file and the
-- CERT_CATALOG_GROUPS/MANDATORY_CERTS arrays in js/seav-data.js in sync manually —
-- there is no automated sync between them.
create table if not exists public.certificate_catalog (
  code text primary key,
  name text not null,
  category text not null default '',
  is_mandatory boolean not null default false,
  sort_order integer not null default 0,
  stcw_ref text not null default '',
  created_at timestamptz default now()
);

-- Backfill for tables created before stcw_ref existed.
alter table public.certificate_catalog add column if not exists stcw_ref text not null default '';

alter table public.certificate_catalog enable row level security;

drop policy if exists "certificate_catalog read authenticated" on public.certificate_catalog;
create policy "certificate_catalog read authenticated"
  on public.certificate_catalog
  for select
  to authenticated
  using (true);

-- Replace seed rows when re-running (safe to re-apply)
delete from public.certificate_catalog;

insert into public.certificate_catalog (code, name, category, is_mandatory, sort_order, stcw_ref) values
  -- Minimum mandatory (yacht crew)
  ('ENG1', 'ENG1 Medical Certificate', 'Minimum mandatory (yacht crew)', true, 1, ''),
  ('PST', 'Personal Survival Techniques (PST)', 'Minimum mandatory (yacht crew)', true, 2, 'STCW A-VI/1-1'),
  ('FPFF', 'Fire Prevention and Fire Fighting (FPFF)', 'Minimum mandatory (yacht crew)', true, 3, 'STCW A-VI/1-2'),
  ('EFA', 'Elementary First Aid (EFA)', 'Minimum mandatory (yacht crew)', true, 4, 'STCW A-VI/1-3'),
  ('PSSR', 'Personal Safety and Social Responsibilities (PSSR)', 'Minimum mandatory (yacht crew)', true, 5, 'STCW A-VI/1-4'),
  ('PSA', 'Proficiency in Security Awareness (PSA)', 'Minimum mandatory (yacht crew)', true, 6, 'STCW A-VI/6-1'),
  -- Identity & seafarer records
  ('PASSPORT', 'Passport / Seafarer Identity Document', 'Identity & seafarer records', false, 10, ''),
  ('DISCHARGE_BOOK', 'Seaman''s Discharge Book', 'Identity & seafarer records', false, 11, ''),
  ('SEAMAN_BOOK', 'Seaman''s Book / CDC', 'Identity & seafarer records', false, 12, ''),
  ('VISA_B1B2', 'US B1/B2 Visa (crew)', 'Identity & seafarer records', false, 13, ''),
  -- STCW basic & combined training
  ('STCW BST', 'STCW Basic Safety Training (Full BST)', 'STCW basic & combined training', false, 20, ''),
  ('STCW A-VI/6-2', 'Proficiency in Designated Security Duties (PDSD)', 'STCW basic & combined training', false, 21, 'STCW A-VI/6-2'),
  ('STCW A-VI/5', 'Ship Security Officer (SSO)', 'STCW basic & combined training', false, 22, 'STCW A-VI/5'),
  -- CoC, rank & MCA yacht qualifications
  ('STCW A-II/1', 'Certificate of Competency (Deck CoC)', 'CoC, rank & MCA yacht qualifications', false, 30, 'STCW A-II/1'),
  ('STCW A-III/1', 'Certificate of Competency (Engineering CoC)', 'CoC, rank & MCA yacht qualifications', false, 31, 'STCW A-III/1'),
  ('STCW A-III/6', 'Electro-Technical Officer CoC', 'CoC, rank & MCA yacht qualifications', false, 32, 'STCW A-III/6'),
  ('MASTER Y200', 'Master (Code Vessel) <200GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 33, ''),
  ('OOW YACHT', 'Officer of the Watch (Yacht) <3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 34, 'STCW A-II/1'),
  ('CHIEF MATE Y', 'Chief Mate (Yacht) <3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 35, 'STCW A-II/2'),
  ('MASTER Y500', 'Master (Yacht) <500GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 36, 'STCW A-II/2'),
  ('MASTER Y3000', 'Master (Yacht) <3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 37, 'STCW A-II/2'),
  -- New MCA top-tier deck CoCs (MSN 1858 Amendment 2, launched 18 May 2026) —
  -- let yacht-career deck officers progress past 3000GT without needing
  -- cargo-ship sea time first.
  ('CHIEF MATE Y UNLTD', 'Chief Mate Unlimited (Yacht) (MCA)', 'CoC, rank & MCA yacht qualifications', false, 38, 'STCW A-II/2'),
  ('MASTER Y UNLTD', 'Master Unlimited (Yacht) (MCA)', 'CoC, rank & MCA yacht qualifications', false, 39, 'STCW A-II/2'),
  -- Current MCA "Small Vessel" engineer officer structure (MIN 524, 2021) —
  -- replaced the old Y1-4 ticket system below as the route to a new CoC,
  -- though many working engineers still hold a legacy Y-ticket, so those
  -- stay listed too.
  ('EOOW SV', 'Engineer Officer of the Watch — Small Vessel <3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 40, 'STCW A-III/1'),
  ('CE SV500', 'Chief Engineer (Small Vessel) <500GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 41, 'STCW A-III/3'),
  ('CE SV3000', 'Chief Engineer (Small Vessel) <3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 42, 'STCW A-III/2'),
  ('EDH', 'Efficient Deck Hand (EDH)', 'CoC, rank & MCA yacht qualifications', false, 43, ''),
  ('RFPNW', 'Rating Forming Part of a Navigational Watch', 'CoC, rank & MCA yacht qualifications', false, 44, 'STCW A-II/4'),
  ('RFPEW', 'Rating Forming Part of an Engineering Watch', 'CoC, rank & MCA yacht qualifications', false, 45, 'STCW A-III/4'),
  ('AEC', 'Approved Engine Course (AEC)', 'CoC, rank & MCA yacht qualifications', false, 46, ''),
  ('MEOL', 'Marine Engine Operators License (MEOL)', 'CoC, rank & MCA yacht qualifications', false, 47, ''),
  ('Y1', 'Yacht Engineer Y1 (MCA, legacy)', 'CoC, rank & MCA yacht qualifications', false, 48, ''),
  ('Y2', 'Yacht Engineer Y2 (MCA, legacy)', 'CoC, rank & MCA yacht qualifications', false, 49, ''),
  ('Y3', 'Yacht Engineer Y3 (MCA, legacy)', 'CoC, rank & MCA yacht qualifications', false, 50, ''),
  ('Y4', 'Yacht Engineer Y4 (MCA, legacy)', 'CoC, rank & MCA yacht qualifications', false, 51, ''),
  -- Navigation, bridge & GMDSS
  ('GMDSS GOC', 'GMDSS General Operator''s Certificate (GOC)', 'Navigation, bridge & GMDSS', false, 60, 'STCW A-IV/2'),
  ('GMDSS ROC', 'GMDSS Restricted Operator''s Certificate (ROC)', 'Navigation, bridge & GMDSS', false, 61, 'STCW A-IV/2'),
  ('ECDIS', 'ECDIS Generic Training', 'Navigation, bridge & GMDSS', false, 62, 'STCW A-II/1, A-II/2'),
  ('ARPA', 'Radar / ARPA Operational', 'Navigation, bridge & GMDSS', false, 63, ''),
  ('HELM-O', 'HELM Operational', 'Navigation, bridge & GMDSS', false, 64, 'STCW A-II/1'),
  ('HELM-M', 'HELM Management', 'Navigation, bridge & GMDSS', false, 65, 'STCW A-II/2'),
  ('NAEST-O', 'NAEST Operational', 'Navigation, bridge & GMDSS', false, 66, ''),
  ('NAEST-M', 'NAEST Management', 'Navigation, bridge & GMDSS', false, 67, ''),
  ('BTM', 'Bridge Team Management', 'Navigation, bridge & GMDSS', false, 68, ''),
  ('BRM', 'Bridge Resource Management', 'Navigation, bridge & GMDSS', false, 69, ''),
  -- Advanced STCW (safety & medical)
  ('STCW A-VI/4-1', 'Medical First Aid (STCW A-VI/4-1)', 'Advanced STCW (safety & medical)', false, 70, 'STCW A-VI/4-1'),
  ('STCW A-VI/4-2', 'Medical Care (STCW A-VI/4-2)', 'Advanced STCW (safety & medical)', false, 71, 'STCW A-VI/4-2'),
  ('STCW A-VI/3', 'Advanced Fire Fighting (AFF)', 'Advanced STCW (safety & medical)', false, 72, 'STCW A-VI/3'),
  ('STCW A-VI/2', 'Proficiency in Survival Craft & Rescue Boats (PSCRB)', 'Advanced STCW (safety & medical)', false, 73, 'STCW A-VI/2'),
  ('STCW A-VI/2-2', 'Fast Rescue Boats (FRB)', 'Advanced STCW (safety & medical)', false, 74, 'STCW A-VI/2'),
  ('STCW HV', 'High Voltage Training', 'Advanced STCW (safety & medical)', false, 75, ''),
  -- Passenger / large-yacht STCW
  ('STCW CROWD', 'Crowd Management Training', 'Passenger / large-yacht STCW', false, 80, ''),
  ('STCW CRISIS', 'Crisis Management & Human Behaviour', 'Passenger / large-yacht STCW', false, 81, ''),
  ('STCW PASS SAF', 'Passenger Safety, Cargo Safety & Hull Integrity', 'Passenger / large-yacht STCW', false, 82, ''),
  -- STCW refresher / update courses
  ('PST UPDATE', 'Personal Survival Techniques — Update', 'STCW refresher / update courses', false, 90, ''),
  ('FPFF UPDATE', 'Fire Prevention & Fire Fighting — Update', 'STCW refresher / update courses', false, 91, ''),
  ('AFF UPDATE', 'Advanced Fire Fighting — Update', 'STCW refresher / update courses', false, 92, ''),
  ('PSCRB UPDATE', 'Survival Craft & Rescue Boats — Update', 'STCW refresher / update courses', false, 93, ''),
  ('FRB UPDATE', 'Fast Rescue Boats — Update', 'STCW refresher / update courses', false, 94, ''),
  -- Interior, galley & hospitality
  ('SHIPS COOK', 'Ship''s Cook Certificate (MCA)', 'Interior, galley & hospitality', false, 100, ''),
  ('FOOD HYGIENE', 'Food Hygiene Level 2 / 3', 'Interior, galley & hospitality', false, 101, ''),
  ('HACCP', 'HACCP / Food Safety Management', 'Interior, galley & hospitality', false, 102, ''),
  ('WSET', 'WSET Wine & Spirits Education', 'Interior, galley & hospitality', false, 103, ''),
  ('BARISTA', 'Barista / Coffee Service Certificate', 'Interior, galley & hospitality', false, 104, ''),
  ('SILVER SVC', 'Silver Service / Butler Training', 'Interior, galley & hospitality', false, 105, ''),
  -- RYA, watersports & diving
  ('RYA PB2', 'RYA Powerboat Level 2', 'RYA, watersports & diving', false, 110, ''),
  ('RYA SRC', 'RYA Short Range Certificate (VHF)', 'RYA, watersports & diving', false, 111, ''),
  ('RYA DAY', 'RYA Day Skipper', 'RYA, watersports & diving', false, 112, ''),
  ('RYA COASTAL', 'RYA Coastal Skipper', 'RYA, watersports & diving', false, 113, ''),
  ('RYA YMC', 'RYA Yachtmaster Coastal', 'RYA, watersports & diving', false, 114, ''),
  ('RYA YMO', 'RYA Yachtmaster Offshore', 'RYA, watersports & diving', false, 115, ''),
  ('RYA YMOCEAN', 'RYA Yachtmaster Ocean', 'RYA, watersports & diving', false, 116, ''),
  ('RYA PWC', 'RYA Personal Watercraft Proficiency (Jet Ski)', 'RYA, watersports & diving', false, 117, ''),
  ('RYA WC', 'RYA Windsurfing / Watercraft Instructor', 'RYA, watersports & diving', false, 118, ''),
  ('PADI OW', 'PADI Open Water Diver', 'RYA, watersports & diving', false, 119, ''),
  ('PADI AOW', 'PADI Advanced Open Water', 'RYA, watersports & diving', false, 120, ''),
  ('PADI RESCUE', 'PADI Rescue Diver', 'RYA, watersports & diving', false, 121, ''),
  ('PADI DM', 'PADI Divemaster', 'RYA, watersports & diving', false, 122, ''),
  ('PADI INSTR', 'PADI Dive Instructor', 'RYA, watersports & diving', false, 123, ''),
  ('WAKE INSTR', 'Wakeboard / Tow Sports Instructor', 'RYA, watersports & diving', false, 124, ''),
  ('KITE L1', 'Kitesurfing / Wing Instructor Level 1', 'RYA, watersports & diving', false, 125, ''),
  -- Other common yacht documents
  ('YELLOW FEVER', 'Yellow Fever Vaccination Certificate', 'Other common yacht documents', false, 130, ''),
  ('DRUG TEST', 'Drug & Alcohol Test Certificate', 'Other common yacht documents', false, 131, ''),
  ('STCW ML5', 'ML5 / ENG1 Equivalent Medical', 'Other common yacht documents', false, 132, ''),
  ('GMDSS', 'GMDSS (legacy code — use GOC/ROC if possible)', 'Other common yacht documents', false, 133, '');

grant select on table public.certificate_catalog to authenticated;
