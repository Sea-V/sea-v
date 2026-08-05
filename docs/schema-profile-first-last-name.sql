-- /docs/schema-profile-first-last-name.sql
-- Splits profile.name into first_name/last_name. Applied live 2026-08-05
-- via Supabase MCP — this file documents that change.
--
-- Design: first_name/last_name are the new source of truth for the Profile
-- form, but `name` is kept in sync on every save (see js/api-mappers.js
-- mapProfileToSupabase — writes name as the concatenation of first+last),
-- specifically so every existing reader of profile.name keeps working with
-- zero changes: the get_public_profile() RPC selects p.name directly, and
-- 9 JS files (dashboard.js, cv-generator.js, cv-engine-render.js,
-- cv-export-docx.js, public-profile.js, references.js, seav-data.js,
-- seav-share.js, state.js) read profile.name. Rewriting all of those to
-- use firstName/lastName instead was deliberately out of scope for this
-- change — it's a much bigger, riskier edit for no functional gain right
-- now, since a synced `name` column gives an identical result. Revisit if
-- a future feature specifically needs surname-first formatting (e.g. a
-- CV template that prints "SORRELL, Jack").

alter table public.profile
  add column if not exists first_name text,
  add column if not exists last_name text;

-- One-time backfill from the existing name column. Last space-separated
-- word -> last_name, everything before it -> first_name. Single-word
-- names get last_name = null (not ""), so a later
-- concat_ws(' ', first_name, last_name) doesn't leave a trailing space.
-- Confirmed correct against live data 2026-08-05, including multi-word
-- names ("Daniel Whitfield" -> Daniel/Whitfield) and single-word names
-- ("Shana" -> Shana/null).
update public.profile
set
  first_name = coalesce(first_name, case
    when name is null or trim(name) = '' then null
    when position(' ' in trim(name)) = 0 then trim(name)
    else trim(substring(trim(name) from 1 for length(trim(name)) - length(split_part(trim(name), ' ', -1)) - 1))
  end),
  last_name = coalesce(last_name, case
    when name is null or trim(name) = '' then null
    when position(' ' in trim(name)) = 0 then null
    else split_part(trim(name), ' ', -1)
  end)
where name is not null and trim(name) <> '';

comment on column public.profile.first_name is
  'Given name(s). Source of truth going forward; profile.name is kept in sync (concat of first_name + last_name) on every write so existing readers keep working unchanged.';
comment on column public.profile.last_name is
  'Surname. See first_name comment.';
