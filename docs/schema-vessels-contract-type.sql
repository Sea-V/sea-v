-- Add the crew member's contract type to each vessel engagement.
-- Applied to the live project on 2026-08-21 via Supabase migration
-- `add_vessels_contract_type`, and smoke-tested the same day: 21 existing
-- rows all null, write/read/revert round trip clean, anon can read
-- contract_type and is still denied salary and leave_package, no new
-- security advisories.
--
-- Purely additive: nullable text with no default, so every existing
-- vessel row is untouched and nothing linked to a vessel (sea time,
-- tenders, references, milestones) is affected. Crew fill it in via
-- Edit on vessels already logged; blank renders as an em dash.
--
-- Free text at the DB level rather than a Postgres enum or a check
-- constraint: the allowed values live in VESSEL_CONTRACT_TYPES in
-- js/seav-data.js and the field is a <select>, so the vocabulary is
-- already closed at the point of entry. An enum would mean a migration
-- every time the industry vocabulary shifts (and it does -- "relief"
-- and "rotational" are both relatively recent as distinct categories),
-- for no gain over a dropdown that only offers valid options.
--
-- Vocabulary is Yotspot's ten job-search "Position Type" values, with
-- "Contract" spelled out as "Fixed-term contract" (a value of
-- "Contract" under a field called "Contract type" is a tautology) and
-- "Relief" and "Freelance" added -- both are everyday yachting
-- engagements that Yotspot's advert-oriented list does not carry.

alter table public.vessels
  add column if not exists contract_type text;

-- Anon's SELECT grant on vessels is column-scoped (see
-- docs/schema-phase2-public-hardening.sql), so a new column is NOT
-- visible to the public profile just by existing. Contract type is
-- deliberately public -- a delivery and a three-year permanent post are
-- very different claims on a CV -- unlike salary and leave_package,
-- which are withheld from anon on purpose and stay that way.
grant select (contract_type) on table public.vessels to anon;
