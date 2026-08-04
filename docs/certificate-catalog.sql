-- SEA-V yacht certificate catalog (reference data)
-- Run once in Supabase SQL Editor (Step 6 in docs/SQL-SETUP-GUIDE.md).
-- The certificates page loads this table when available; js/seav-data.js is the offline fallback.
-- Re-run to refresh seed rows after editing this file. Keep this file and the
-- CERT_CATALOG_GROUPS/MANDATORY_CERTS arrays in js/seav-data.js in sync manually —
-- there is no automated sync between them.
--
-- Category taxonomy reorganized 2026-08-04 into an 18-group structure aligned to
-- STCW/MCA legal basis (Medical, Identity, Mandatory STCW, Security, CoC Deck/Eng,
-- Ratings, Engineering quals, Professional exam modules, Nav & comms, Advanced STCW,
-- Passenger ops, Refresher, RYA & recreational, Diving, Hospitality, Health &
-- compliance). Group DISPLAY ORDER is driven by sort_order, not alphabetical —
-- see buildCatalogGroupsFromDb() in js/seav-data.js.
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
  -- Medical certification (additional)
  ('STCW ML5', 'ML5 / ENG1 Equivalent Medical', 'Medical certification (additional)', false, 8, ''),
  -- Identity & seafarer documents
  ('PASSPORT', 'Passport / Seafarer Identity Document', 'Identity & seafarer documents', false, 10, ''),
  ('DISCHARGE_BOOK', 'Seaman''s Discharge Book', 'Identity & seafarer documents', false, 11, ''),
  ('SEAMAN_BOOK', 'Seaman''s Book / CDC', 'Identity & seafarer documents', false, 12, ''),
  ('VISA_B1B2', 'US B1/B2 Visa (crew)', 'Identity & seafarer documents', false, 13, ''),
  -- Mandatory Basic Safety (STCW) — combined certificate
  ('STCW BST', 'STCW Basic Safety Training (Full BST)', 'Mandatory Basic Safety (STCW) — combined certificate', false, 20, ''),
  -- Security (STCW)
  ('STCW A-VI/6-2', 'Proficiency in Designated Security Duties (PDSD)', 'Security (STCW)', false, 21, 'STCW A-VI/6-2'),
  ('STCW A-VI/5', 'Ship Security Officer (SSO)', 'Security (STCW)', false, 22, 'STCW A-VI/5'),
  -- Certificates of Competency — Deck
  ('STCW A-II/1', 'Certificate of Competency (Deck CoC)', 'Certificates of Competency — Deck', false, 30, 'STCW A-II/1'),
  ('MASTER Y200', 'Master (Code Vessel) <200GT (MCA)', 'Certificates of Competency — Deck', false, 31, ''),
  ('OOW YACHT', 'Officer of the Watch (Yacht) <3000GT (MCA)', 'Certificates of Competency — Deck', false, 32, 'STCW A-II/1'),
  ('CHIEF MATE Y', 'Chief Mate (Yacht) <3000GT (MCA)', 'Certificates of Competency — Deck', false, 33, 'STCW A-II/2'),
  ('MASTER Y500', 'Master (Yacht) <500GT (MCA)', 'Certificates of Competency — Deck', false, 34, 'STCW A-II/2'),
  ('MASTER Y3000', 'Master (Yacht) <3000GT (MCA)', 'Certificates of Competency — Deck', false, 35, 'STCW A-II/2'),
  ('CHIEF MATE Y UNLTD', 'Chief Mate Unlimited (Yacht) (MCA)', 'Certificates of Competency — Deck', false, 36, 'STCW A-II/2'),
  ('MASTER Y UNLTD', 'Master Unlimited (Yacht) (MCA)', 'Certificates of Competency — Deck', false, 37, 'STCW A-II/2'),
  ('UK CEC', 'UK Certificate of Equivalent Competency (CEC)', 'Certificates of Competency — Deck', false, 38, ''),
  -- Certificates of Competency — Engineering
  ('STCW A-III/1', 'Certificate of Competency (Engineering CoC)', 'Certificates of Competency — Engineering', false, 40, 'STCW A-III/1'),
  ('STCW A-III/6', 'Electro-Technical Officer CoC', 'Certificates of Competency — Engineering', false, 41, 'STCW A-III/6'),
  ('EOOW SV', 'Engineer Officer of the Watch — Small Vessel <3000GT (MCA)', 'Certificates of Competency — Engineering', false, 42, 'STCW A-III/1'),
  ('CE SV500', 'Chief Engineer (Small Vessel) <500GT (MCA)', 'Certificates of Competency — Engineering', false, 43, 'STCW A-III/3'),
  ('CE SV3000', 'Chief Engineer (Small Vessel) <3000GT (MCA)', 'Certificates of Competency — Engineering', false, 44, 'STCW A-III/2'),
  ('Y1', 'Yacht Engineer Y1 (MCA, legacy)', 'Certificates of Competency — Engineering', false, 45, ''),
  ('Y2', 'Yacht Engineer Y2 (MCA, legacy)', 'Certificates of Competency — Engineering', false, 46, ''),
  ('Y3', 'Yacht Engineer Y3 (MCA, legacy)', 'Certificates of Competency — Engineering', false, 47, ''),
  ('Y4', 'Yacht Engineer Y4 (MCA, legacy)', 'Certificates of Competency — Engineering', false, 48, ''),
  -- Ratings
  ('YACHT RATING', 'Yacht Rating Certificate', 'Ratings', false, 50, 'STCW II/4'),
  ('EDH', 'Efficient Deck Hand (EDH)', 'Ratings', false, 51, ''),
  ('RFPNW', 'Rating Forming Part of a Navigational Watch', 'Ratings', false, 52, 'STCW A-II/4'),
  ('RFPEW', 'Rating Forming Part of an Engineering Watch', 'Ratings', false, 53, 'STCW A-III/4'),
  -- Engineering qualifications
  ('AEC', 'Approved Engine Course (AEC)', 'Engineering qualifications', false, 55, ''),
  ('MEOL', 'Marine Engine Operators License (MEOL)', 'Engineering qualifications', false, 56, ''),
  -- Professional examination modules (MCA yacht)
  ('NAV RADAR OOW', 'Navigation and Radar (OOW Yachts)', 'Professional examination modules (MCA yacht)', false, 60, ''),
  ('GEN SHIP KNOW', 'General Ship Knowledge (OOW Yachts)', 'Professional examination modules (MCA yacht)', false, 61, ''),
  ('SEAMANSHIP MET MY', 'Seamanship and Meteorology (Master Yachts)', 'Professional examination modules (MCA yacht)', false, 62, ''),
  ('STABILITY MY', 'Stability (Master Yachts)', 'Professional examination modules (MCA yacht)', false, 63, ''),
  ('BUSINESS LAW MY', 'Business and Law (Master Yachts)', 'Professional examination modules (MCA yacht)', false, 64, ''),
  ('NAV RADAR ARPA MY', 'Navigation, Radar and ARPA Simulator (Master Yachts)', 'Professional examination modules (MCA yacht)', false, 65, ''),
  ('CELESTIAL NAV', 'Celestial Navigation (MCA professional exam)', 'Professional examination modules (MCA yacht)', false, 66, ''),
  ('APPLIED MET', 'Applied Marine Meteorology', 'Professional examination modules (MCA yacht)', false, 67, ''),
  ('MGT PASSAGE PLAN', 'Management Level Passage Planning', 'Professional examination modules (MCA yacht)', false, 68, ''),
  ('MGT BRIDGE OPS', 'Management of Bridge Operations', 'Professional examination modules (MCA yacht)', false, 69, ''),
  ('MGT YACHT OPS', 'Management of Yacht Operations', 'Professional examination modules (MCA yacht)', false, 70, ''),
  ('MARINE ENG SYS', 'Marine Engineering Systems', 'Professional examination modules (MCA yacht)', false, 71, ''),
  ('MARINE VESSELS SM', 'Marine Vessels — Structures and Maintenance', 'Professional examination modules (MCA yacht)', false, 72, ''),
  ('SHIP STABILITY TPA', 'Ship Stability: Theory and Practical Application', 'Professional examination modules (MCA yacht)', false, 73, ''),
  ('SHIPBOARD MGT', 'Shipboard Management', 'Professional examination modules (MCA yacht)', false, 74, ''),
  ('SHIPMASTERS LAW', 'Shipmaster''s Law and Business', 'Professional examination modules (MCA yacht)', false, 75, ''),
  ('CM NAV STAB ASSESS', 'MCA Assessment: Chief Mate Navigation and Stability (Yacht Unlimited)', 'Professional examination modules (MCA yacht)', false, 76, ''),
  -- Navigation & communications
  ('GMDSS GOC', 'GMDSS General Operator''s Certificate (GOC)', 'Navigation & communications', false, 80, 'STCW A-IV/2'),
  ('GMDSS ROC', 'GMDSS Restricted Operator''s Certificate (ROC)', 'Navigation & communications', false, 81, 'STCW A-IV/2'),
  ('ECDIS', 'ECDIS Generic Training', 'Navigation & communications', false, 82, 'STCW A-II/1, A-II/2'),
  ('ARPA', 'Radar / ARPA Operational', 'Navigation & communications', false, 83, ''),
  ('HELM-O', 'HELM Operational', 'Navigation & communications', false, 84, 'STCW A-II/1'),
  ('HELM-M', 'HELM Management', 'Navigation & communications', false, 85, 'STCW A-II/2'),
  ('NAEST-O', 'NAEST Operational', 'Navigation & communications', false, 86, ''),
  ('NAEST-M', 'NAEST Management', 'Navigation & communications', false, 87, ''),
  ('BTM', 'Bridge Team Management', 'Navigation & communications', false, 88, ''),
  ('BRM', 'Bridge Resource Management', 'Navigation & communications', false, 89, ''),
  ('GMDSS', 'GMDSS (legacy code — use GOC/ROC if possible)', 'Navigation & communications', false, 90, ''),
  -- Advanced STCW
  ('STCW A-VI/4-1', 'Medical First Aid (STCW A-VI/4-1)', 'Advanced STCW', false, 95, 'STCW A-VI/4-1'),
  ('STCW A-VI/4-2', 'Medical Care (STCW A-VI/4-2)', 'Advanced STCW', false, 96, 'STCW A-VI/4-2'),
  ('STCW A-VI/3', 'Advanced Fire Fighting (AFF)', 'Advanced STCW', false, 97, 'STCW A-VI/3'),
  ('STCW A-VI/2', 'Proficiency in Survival Craft & Rescue Boats (PSCRB)', 'Advanced STCW', false, 98, 'STCW A-VI/2'),
  ('STCW A-VI/2-2', 'Fast Rescue Boats (FRB)', 'Advanced STCW', false, 99, 'STCW A-VI/2'),
  ('STCW HV', 'High Voltage Training', 'Advanced STCW', false, 100, ''),
  -- Passenger operations
  ('STCW CROWD', 'Crowd Management Training', 'Passenger operations', false, 105, ''),
  ('STCW CRISIS', 'Crisis Management & Human Behaviour', 'Passenger operations', false, 106, ''),
  ('STCW PASS SAF', 'Passenger Safety, Cargo Safety & Hull Integrity', 'Passenger operations', false, 107, ''),
  -- Refresher training
  ('PST UPDATE', 'Personal Survival Techniques — Update', 'Refresher training', false, 110, ''),
  ('FPFF UPDATE', 'Fire Prevention & Fire Fighting — Update', 'Refresher training', false, 111, ''),
  ('AFF UPDATE', 'Advanced Fire Fighting — Update', 'Refresher training', false, 112, ''),
  ('PSCRB UPDATE', 'Survival Craft & Rescue Boats — Update', 'Refresher training', false, 113, ''),
  ('FRB UPDATE', 'Fast Rescue Boats — Update', 'Refresher training', false, 114, ''),
  -- RYA & recreational qualifications
  ('RYA PB2', 'RYA Powerboat Level 2', 'RYA & recreational qualifications', false, 120, ''),
  ('RYA SRC', 'RYA Short Range Certificate (VHF)', 'RYA & recreational qualifications', false, 121, ''),
  ('RYA DAY', 'RYA Day Skipper', 'RYA & recreational qualifications', false, 122, ''),
  ('RYA COASTAL', 'RYA Coastal Skipper', 'RYA & recreational qualifications', false, 123, ''),
  ('RYA YMC', 'RYA Yachtmaster Coastal', 'RYA & recreational qualifications', false, 124, ''),
  ('RYA YMO', 'RYA Yachtmaster Offshore', 'RYA & recreational qualifications', false, 125, ''),
  ('RYA YMOCEAN', 'RYA Yachtmaster Ocean', 'RYA & recreational qualifications', false, 126, ''),
  ('RYA PWC', 'RYA Personal Watercraft Proficiency (Jet Ski)', 'RYA & recreational qualifications', false, 127, ''),
  ('RYA WC', 'RYA Windsurfing / Watercraft Instructor', 'RYA & recreational qualifications', false, 128, ''),
  ('WAKE INSTR', 'Wakeboard / Tow Sports Instructor', 'RYA & recreational qualifications', false, 129, ''),
  ('KITE L1', 'Kitesurfing / Wing Instructor Level 1', 'RYA & recreational qualifications', false, 130, ''),
  -- Diving qualifications
  ('PADI OW', 'PADI Open Water Diver', 'Diving qualifications', false, 135, ''),
  ('PADI AOW', 'PADI Advanced Open Water', 'Diving qualifications', false, 136, ''),
  ('PADI RESCUE', 'PADI Rescue Diver', 'Diving qualifications', false, 137, ''),
  ('PADI DM', 'PADI Divemaster', 'Diving qualifications', false, 138, ''),
  ('PADI INSTR', 'PADI Dive Instructor', 'Diving qualifications', false, 139, ''),
  -- Hospitality qualifications
  ('SHIPS COOK', 'Ship''s Cook Certificate (MCA)', 'Hospitality qualifications', false, 145, ''),
  ('FOOD HYGIENE', 'Food Hygiene Level 2 / 3', 'Hospitality qualifications', false, 146, ''),
  ('HACCP', 'HACCP / Food Safety Management', 'Hospitality qualifications', false, 147, ''),
  ('WSET', 'WSET Wine & Spirits Education', 'Hospitality qualifications', false, 148, ''),
  ('BARISTA', 'Barista / Coffee Service Certificate', 'Hospitality qualifications', false, 149, ''),
  ('SILVER SVC', 'Silver Service / Butler Training', 'Hospitality qualifications', false, 150, ''),
  -- Health & compliance
  ('YELLOW FEVER', 'Yellow Fever Vaccination Certificate', 'Health & compliance', false, 155, ''),
  ('DRUG TEST', 'Drug & Alcohol Test Certificate', 'Health & compliance', false, 156, '');

grant select on table public.certificate_catalog to authenticated;
