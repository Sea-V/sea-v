-- Add a Training Record Book (TRB) progress tracker to profile.
-- Applied to the live project on 2026-08-01 via migration
-- `add_profile_trb_fields`.
--
-- Purely additive: three nullable text columns, no default, so every
-- existing profile row is untouched.
--
-- trb_status -- one of not_started / in_progress / submitted_to_mca /
-- completed. trb_target_qualification / trb_notes are free text.
--
-- Sourced from the Red Ensign Group Yacht Code (REG-YC) review: the TRB
-- is the MCA-approved book ratings and trainee deck/engineer officers
-- fill in task-by-task, signed off by the Master, required to submit
-- for OOW/CoC progression. Sits alongside SEA-V's existing OOW/Master
-- <3000GT sea-time eligibility tracker on the Sea Time page.
--
-- One row per user (like the rest of `profile`), not a per-vessel field --
-- a crew member carries a single TRB across placements until it's
-- submitted, mirroring how the real document works.
--
-- Private only: not exposed to the public profile or CV Generator (not
-- added to OWNER_PROFILE_COLUMNS's public counterpart, and profile's
-- anon/public read path is the get_public_profile() RPC, which this
-- migration does not touch).

alter table public.profile
  add column trb_status text,
  add column trb_target_qualification text,
  add column trb_notes text;
