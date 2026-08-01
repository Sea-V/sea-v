-- Add optional "additional onboard duties" and "leave / rotation package"
-- fields to vessels. Applied to the live project on 2026-08-01 via
-- migrations `add_vessels_duties_and_leave` and
-- `grant_anon_vessels_additional_duties`.
--
-- Purely additive: both columns are nullable text with no default, so
-- every existing vessel row is untouched.
--
-- additional_duties -- a comma-joined list of appointed onboard roles
-- (Safety Officer, Safety Representative, Ship Security Officer (SSO),
-- Person in Charge of Medical Care, or a free-text "Other" entry), same
-- storage convention as profile.passports_held / profile.visas_held.
-- Sourced from the Red Ensign Group Yacht Code (REG-YC) / MCA Master's
-- Guide review, which names these as mandatory appointed roles on every
-- commercial yacht, logged in the Official Log Book -- a genuine CV
-- differentiator crew currently have nowhere to record. Treated as public
-- (like vessel IMO/MMSI): non-sensitive, and the whole point is for
-- recruiters to see it, so it's whitelisted for the public profile too.
--
-- leave_package -- free-text description of the leave/rotation
-- arrangement on that vessel (e.g. "2:1 rotation", "8 weeks on/4 off",
-- "20 days/year"). Treated as private (like vessels.salary already is):
-- an employment term, not shown on the public profile or CV Generator.

alter table public.vessels
  add column additional_duties text,
  add column leave_package text;

-- Anon's SELECT grant on vessels is column-scoped (see
-- docs/schema-phase2-public-hardening.sql), so new columns aren't
-- automatically visible to the public profile just by existing -- they
-- need an explicit grant. Only additional_duties gets one; leave_package
-- deliberately does not.
grant select (additional_duties) on table public.vessels to anon;
