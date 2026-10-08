-- Rate limit on the referee verification email (GDPR art. 32 / abuse, v579, 2026-10-08)
--
-- APPLIED LIVE + SMOKE-TESTED 2026-10-08 (results at the bottom).
--
-- Before: any signed-in member could make SEA-V send verify@sea-v.com mail
-- to any address, as often as they liked (CLAUDE.md thread 9) — a spam and
-- harassment channel on SEA-V's own domain. request_reference_verification
-- is the only door to that email (the edge function sends only after this
-- RPC returns a token), so the limit lives here. Counted from the tokens
-- table over a rolling 24 hours:
--   10 requests per member
--    3 sends of the same reference (resends)
--    5 requests to the same referee address, across ALL members
-- Real use on 2026-10-08: one request ever. The body is otherwise
-- unchanged from the live definition.

create or replace function public.request_reference_verification(p_reference_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  uid uuid := auth.uid();
  ref_row public.sea_references%rowtype;
  profile_row public.profile%rowtype;
  plain_token text;
  token_hash text;
  expires_at timestamptz;
  verify_url text;
  crew_email text;
  referee_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into ref_row
  from public.sea_references
  where id = p_reference_id and user_id = uid;

  if not found then
    raise exception 'Reference not found';
  end if;

  if coalesce(trim(ref_row.email), '') = '' then
    raise exception 'Referee email is required';
  end if;

  if ref_row.status = 'Verified' then
    raise exception 'Reference is already verified';
  end if;

  select * into profile_row from public.profile where user_id = uid limit 1;
  crew_email := lower(trim(coalesce(profile_row.email, '')));
  referee_email := lower(trim(ref_row.email));

  if crew_email <> '' and referee_email = crew_email then
    raise exception 'Referee email cannot match your own email';
  end if;

  -- v579 rate limits (rolling 24 hours).
  if (select count(*) from public.reference_verification_tokens t
      where t.user_id = uid and t.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have sent 10 verification requests in the last 24 hours. Please try again tomorrow.';
  end if;

  if (select count(*) from public.reference_verification_tokens t
      where t.reference_id = ref_row.id and t.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'This reference has been sent 3 times in the last 24 hours. Please try again tomorrow.';
  end if;

  if (select count(*) from public.reference_verification_tokens t
      where t.sent_to_email = referee_email and t.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'This referee has received several requests today. Please try again tomorrow.';
  end if;

  plain_token := encode(gen_random_bytes(32), 'hex');
  token_hash := public.hash_reference_verification_token(plain_token);
  expires_at := now() + interval '14 days';

  update public.reference_verification_tokens t
  set used_at = now()
  where t.reference_id = ref_row.id
    and t.used_at is null
    and t.expires_at > now();

  insert into public.reference_verification_tokens (
    reference_id, user_id, token_hash, sent_to_email, expires_at
  ) values (
    ref_row.id, uid, token_hash, referee_email, expires_at
  );

  update public.sea_references
  set
    status = 'Sent for Verification',
    updated_at = now()
  where id = ref_row.id;

  verify_url := public.reference_verification_site_url()
    || '/verify-reference.html?token='
    || plain_token;

  return jsonb_build_object(
    'reference_id', ref_row.id,
    'referee_email', referee_email,
    'referee_name', ref_row.name,
    'crew_name', coalesce(profile_row.name, 'SEA-V member'),
    'expires_at', expires_at,
    'verify_url', verify_url,
    'token', plain_token
  );
end;
$function$;

-- SMOKE TEST 2026-10-08 (real authenticated role, RPC only — no email is
-- sent from SQL; everything rolled back):
--   same reference x4        -> 3 allowed, 4th: "sent 3 times in the last 24 hours"
--   same address, 6 refs     -> 5 allowed, 6th: "received several requests today"
--   then 6 more addresses    -> 5 allowed (member total 10), next: "10 verification requests"
--   live tokens afterwards: 1 (unchanged); no probe rows left
--   EXECUTE grants unchanged; security advisors 23 before / 23 after.
-- test-supabase.mjs testOwnerWriteGuards gained a "4th send refused" probe
-- (runs only with SEAV_TEST_EMAIL / SEAV_TEST_PASSWORD).
