-- SEA-V yacht certificate catalog (reference data)
-- Run once in Supabase SQL Editor.
-- This stores the master list for reporting/admin; the app dropdown reads js/seav-data.js today.
-- Keep this file in sync when adding certificates to CERT_CATALOG_GROUPS.

create table if not exists public.certificate_catalog (
  code text primary key,
  name text not null,
  category text not null default '',
  is_mandatory boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.certificate_catalog enable row level security;

drop policy if exists "certificate_catalog read authenticated" on public.certificate_catalog;
create policy "certificate_catalog read authenticated"
  on public.certificate_catalog
  for select
  to authenticated
  using (true);

-- Replace seed rows when re-running (safe to re-apply)
delete from public.certificate_catalog;

insert into public.certificate_catalog (code, name, category, is_mandatory, sort_order) values
  -- Minimum mandatory (yacht crew)
  ('ENG1', 'ENG1 Medical Certificate', 'Minimum mandatory (yacht crew)', true, 1),
  ('PST', 'Personal Survival Techniques (PST)', 'Minimum mandatory (yacht crew)', true, 2),
  ('FPFF', 'Fire Prevention and Fire Fighting (FPFF)', 'Minimum mandatory (yacht crew)', true, 3),
  ('EFA', 'Elementary First Aid (EFA)', 'Minimum mandatory (yacht crew)', true, 4),
  ('PSSR', 'Personal Safety and Social Responsibilities (PSSR)', 'Minimum mandatory (yacht crew)', true, 5),
  ('PSA', 'Proficiency in Security Awareness (PSA)', 'Minimum mandatory (yacht crew)', true, 6),
  -- Identity & seafarer records
  ('PASSPORT', 'Passport / Seafarer Identity Document', 'Identity & seafarer records', false, 10),
  ('DISCHARGE_BOOK', 'Seaman''s Discharge Book', 'Identity & seafarer records', false, 11),
  ('SEAMAN_BOOK', 'Seaman''s Book / CDC', 'Identity & seafarer records', false, 12),
  ('VISA_B1B2', 'US B1/B2 Visa (crew)', 'Identity & seafarer records', false, 13),
  -- STCW basic & combined training
  ('STCW BST', 'STCW Basic Safety Training (Full BST)', 'STCW basic & combined training', false, 20),
  ('STCW A-VI/6-2', 'Proficiency in Designated Security Duties (PDSD)', 'STCW basic & combined training', false, 21),
  ('STCW A-VI/5', 'Ship Security Officer (SSO)', 'STCW basic & combined training', false, 22),
  -- CoC, rank & MCA yacht qualifications
  ('STCW A-II/1', 'Certificate of Competency (Deck CoC)', 'CoC, rank & MCA yacht qualifications', false, 30),
  ('STCW A-III/1', 'Certificate of Competency (Engineering CoC)', 'CoC, rank & MCA yacht qualifications', false, 31),
  ('STCW A-III/6', 'Electro-Technical Officer CoC', 'CoC, rank & MCA yacht qualifications', false, 32),
  ('OOW YACHT', 'Officer of the Watch (Yacht)', 'CoC, rank & MCA yacht qualifications', false, 33),
  ('CHIEF MATE Y', 'Chief Mate Yacht (MCA)', 'CoC, rank & MCA yacht qualifications', false, 34),
  ('MASTER Y3000', 'Master Yacht 3000GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 35),
  ('MASTER Y500', 'Master Yacht 500GT (MCA)', 'CoC, rank & MCA yacht qualifications', false, 36),
  ('EDH', 'Efficient Deck Hand (EDH)', 'CoC, rank & MCA yacht qualifications', false, 37),
  ('RFPNW', 'Rating Forming Part of a Navigational Watch', 'CoC, rank & MCA yacht qualifications', false, 38),
  ('RFPEW', 'Rating Forming Part of an Engineering Watch', 'CoC, rank & MCA yacht qualifications', false, 39),
  ('AEC', 'Approved Engine Course (AEC)', 'CoC, rank & MCA yacht qualifications', false, 40),
  ('MEOL', 'Motor Engineering Operational Level (MEOL)', 'CoC, rank & MCA yacht qualifications', false, 41),
  ('Y1', 'Yacht Engineer Y1 (MCA)', 'CoC, rank & MCA yacht qualifications', false, 42),
  ('Y2', 'Yacht Engineer Y2 (MCA)', 'CoC, rank & MCA yacht qualifications', false, 43),
  ('Y3', 'Yacht Engineer Y3 (MCA)', 'CoC, rank & MCA yacht qualifications', false, 44),
  ('Y4', 'Yacht Engineer Y4 (MCA)', 'CoC, rank & MCA yacht qualifications', false, 45),
  -- Navigation, bridge & GMDSS
  ('GMDSS GOC', 'GMDSS General Operator''s Certificate (GOC)', 'Navigation, bridge & GMDSS', false, 50),
  ('GMDSS ROC', 'GMDSS Restricted Operator''s Certificate (ROC)', 'Navigation, bridge & GMDSS', false, 51),
  ('ECDIS', 'ECDIS Generic Training', 'Navigation, bridge & GMDSS', false, 52),
  ('ARPA', 'Radar / ARPA Operational', 'Navigation, bridge & GMDSS', false, 53),
  ('HELM-O', 'HELM Operational', 'Navigation, bridge & GMDSS', false, 54),
  ('HELM-M', 'HELM Management', 'Navigation, bridge & GMDSS', false, 55),
  ('NAEST-O', 'NAEST Operational', 'Navigation, bridge & GMDSS', false, 56),
  ('NAEST-M', 'NAEST Management', 'Navigation, bridge & GMDSS', false, 57),
  ('BTM', 'Bridge Team Management', 'Navigation, bridge & GMDSS', false, 58),
  ('BRM', 'Bridge Resource Management', 'Navigation, bridge & GMDSS', false, 59),
  -- Advanced STCW (safety & medical)
  ('STCW A-VI/4-1', 'Medical First Aid (STCW A-VI/4-1)', 'Advanced STCW (safety & medical)', false, 60),
  ('STCW A-VI/4-2', 'Medical Care (STCW A-VI/4-2)', 'Advanced STCW (safety & medical)', false, 61),
  ('STCW A-VI/3', 'Advanced Fire Fighting (AFF)', 'Advanced STCW (safety & medical)', false, 62),
  ('STCW A-VI/2', 'Proficiency in Survival Craft & Rescue Boats (PSCRB)', 'Advanced STCW (safety & medical)', false, 63),
  ('STCW A-VI/2-2', 'Fast Rescue Boats (FRB)', 'Advanced STCW (safety & medical)', false, 64),
  ('STCW HV', 'High Voltage Training', 'Advanced STCW (safety & medical)', false, 65),
  -- Passenger / large-yacht STCW
  ('STCW CROWD', 'Crowd Management Training', 'Passenger / large-yacht STCW', false, 70),
  ('STCW CRISIS', 'Crisis Management & Human Behaviour', 'Passenger / large-yacht STCW', false, 71),
  ('STCW PASS SAF', 'Passenger Safety, Cargo Safety & Hull Integrity', 'Passenger / large-yacht STCW', false, 72),
  -- STCW refresher / update courses
  ('PST UPDATE', 'Personal Survival Techniques — Update', 'STCW refresher / update courses', false, 80),
  ('FPFF UPDATE', 'Fire Prevention & Fire Fighting — Update', 'STCW refresher / update courses', false, 81),
  ('AFF UPDATE', 'Advanced Fire Fighting — Update', 'STCW refresher / update courses', false, 82),
  ('PSCRB UPDATE', 'Survival Craft & Rescue Boats — Update', 'STCW refresher / update courses', false, 83),
  ('FRB UPDATE', 'Fast Rescue Boats — Update', 'STCW refresher / update courses', false, 84),
  -- Interior, galley & hospitality
  ('SHIPS COOK', 'Ship''s Cook Certificate (MCA)', 'Interior, galley & hospitality', false, 90),
  ('FOOD HYGIENE', 'Food Hygiene Level 2 / 3', 'Interior, galley & hospitality', false, 91),
  ('HACCP', 'HACCP / Food Safety Management', 'Interior, galley & hospitality', false, 92),
  ('WSET', 'WSET Wine & Spirits Education', 'Interior, galley & hospitality', false, 93),
  ('BARISTA', 'Barista / Coffee Service Certificate', 'Interior, galley & hospitality', false, 94),
  ('SILVER SVC', 'Silver Service / Butler Training', 'Interior, galley & hospitality', false, 95),
  -- RYA, watersports & diving
  ('RYA PB2', 'RYA Powerboat Level 2', 'RYA, watersports & diving', false, 100),
  ('RYA SRC', 'RYA Short Range Certificate (VHF)', 'RYA, watersports & diving', false, 101),
  ('RYA DAY', 'RYA Day Skipper', 'RYA, watersports & diving', false, 102),
  ('RYA COASTAL', 'RYA Coastal Skipper', 'RYA, watersports & diving', false, 103),
  ('RYA YMC', 'RYA Yachtmaster Coastal', 'RYA, watersports & diving', false, 104),
  ('RYA YMO', 'RYA Yachtmaster Offshore', 'RYA, watersports & diving', false, 105),
  ('RYA YMOCEAN', 'RYA Yachtmaster Ocean', 'RYA, watersports & diving', false, 106),
  ('RYA PWC', 'RYA Personal Watercraft Proficiency (Jet Ski)', 'RYA, watersports & diving', false, 107),
  ('RYA WC', 'RYA Windsurfing / Watercraft Instructor', 'RYA, watersports & diving', false, 108),
  ('PADI OW', 'PADI Open Water Diver', 'RYA, watersports & diving', false, 109),
  ('PADI AOW', 'PADI Advanced Open Water', 'RYA, watersports & diving', false, 110),
  ('PADI RESCUE', 'PADI Rescue Diver', 'RYA, watersports & diving', false, 111),
  ('PADI DM', 'PADI Divemaster', 'RYA, watersports & diving', false, 112),
  ('PADI INSTR', 'PADI Dive Instructor', 'RYA, watersports & diving', false, 113),
  ('WAKE INSTR', 'Wakeboard / Tow Sports Instructor', 'RYA, watersports & diving', false, 114),
  ('KITE L1', 'Kitesurfing / Wing Instructor Level 1', 'RYA, watersports & diving', false, 115),
  -- Other common yacht documents
  ('YELLOW FEVER', 'Yellow Fever Vaccination Certificate', 'Other common yacht documents', false, 120),
  ('DRUG TEST', 'Drug & Alcohol Test Certificate', 'Other common yacht documents', false, 121),
  ('STCW ML5', 'ML5 / ENG1 Equivalent Medical', 'Other common yacht documents', false, 122),
  ('GMDSS', 'GMDSS (legacy code — use GOC/ROC if possible)', 'Other common yacht documents', false, 123);

grant select on table public.certificate_catalog to authenticated;
