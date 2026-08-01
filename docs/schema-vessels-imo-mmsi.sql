-- Add optional IMO and MMSI identifier fields to vessels.
-- Applied to the live project on 2026-08-01 via Supabase migration
-- `add_vessels_imo_mmsi`.
--
-- Purely additive: both columns are nullable with no default, so every
-- existing vessel row is untouched -- nobody needs to re-enter vessels
-- or anything linked to them (sea time, tenders, references, etc. all
-- still key off the same vessel id). Crew can optionally fill these in
-- via Edit on vessels already logged.
--
-- These are data-capture fields only, not verified against any external
-- registry/AIS source yet -- see project discussion on AIS/IMO lookup
-- feasibility (MarineTraffic/Datalastic/VesselFinder cost, Equasis ToS
-- forbidding API access, and coverage gaps for smaller private yachts
-- without IMO numbers). Live verification is a possible post-launch
-- addition once a provider is chosen; this just lays the groundwork.

alter table public.vessels
  add column imo text,
  add column mmsi text;
