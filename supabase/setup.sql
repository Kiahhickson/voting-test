-- ===========================================================================
-- Voting backend for Supabase.
-- Paste this whole file into: Supabase dashboard → SQL Editor → New query → Run
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Votes table. Nobody can read or write it directly from the website
-- (RLS on, no policies); the only way in is the cast_vote() function below.
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  voter_token   uuid not null unique,          -- from the visitor's cookie
  ip_hash       text not null,                 -- salted SHA-256, never the raw IP
  first_choice  text not null,
  second_choice text not null,
  third_choice  text not null,
  constraint distinct_choices check (
    first_choice <> second_choice and
    first_choice <> third_choice  and
    second_choice <> third_choice
  )
);

create index if not exists votes_ip_hash_idx on public.votes (ip_hash);

alter table public.votes enable row level security;
revoke all on public.votes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- cast_vote(): validates, de-duplicates and records a vote.
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_token  uuid,
  p_first  text,
  p_second text,
  p_third  text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- ▼▼▼ EDIT THESE ▼▼▼
  -- Must match the option ids in config.js
  allowed_options text[] := array['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];
  -- Max votes per IP address. Set higher (e.g. 5) if many people share a
  -- network (offices, schools, mobile carriers); set to 0 to disable.
  max_votes_per_ip int := 1;
  -- Change to any random string. Keeps stored IP hashes from being reversed.
  salt text := 'CHANGE-ME-to-a-long-random-string';
  -- ▲▲▲ EDIT THESE ▲▲▲

  headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  ip text;
  hashed text;
begin
  -- Validate the picks
  if p_token is null
     or not (p_first = any(allowed_options))
     or not (p_second = any(allowed_options))
     or not (p_third = any(allowed_options))
     or p_first = p_second or p_first = p_third or p_second = p_third then
    return json_build_object('ok', false, 'reason', 'invalid_vote');
  end if;

  -- Work out the visitor's IP. Supabase sits behind Cloudflare, which sets
  -- cf-connecting-ip and cannot be spoofed by the browser.
  ip := coalesce(
    nullif(headers->>'cf-connecting-ip', ''),
    nullif(trim(split_part(headers->>'x-forwarded-for', ',', 1)), ''),
    nullif(headers->>'x-real-ip', ''),
    'unknown'
  );
  hashed := encode(digest(ip || salt, 'sha256'), 'hex');

  -- Same cookie already voted?
  if exists (select 1 from votes where voter_token = p_token) then
    return json_build_object('ok', false, 'reason', 'already_voted');
  end if;

  -- Same IP already voted (too many times)?
  if max_votes_per_ip > 0 and ip <> 'unknown'
     and (select count(*) from votes where ip_hash = hashed) >= max_votes_per_ip then
    return json_build_object('ok', false, 'reason', 'already_voted');
  end if;

  insert into votes (voter_token, ip_hash, first_choice, second_choice, third_choice)
  values (p_token, hashed, p_first, p_second, p_third);

  return json_build_object('ok', true);
exception
  when unique_violation then
    return json_build_object('ok', false, 'reason', 'already_voted');
end;
$$;

revoke all on function public.cast_vote(uuid, text, text, text) from public;
grant execute on function public.cast_vote(uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Results (private: only visible to you in the dashboard, not the website).
-- Scoring: 1st choice = 3 points, 2nd = 2, 3rd = 1.
-- View with:  select * from public.results;
-- ---------------------------------------------------------------------------
create or replace view public.results
with (security_invoker = true) as
select
  option,
  sum(points)                         as points,
  count(*) filter (where points = 3)  as first_votes,
  count(*) filter (where points = 2)  as second_votes,
  count(*) filter (where points = 1)  as third_votes
from (
  select first_choice  as option, 3 as points from public.votes
  union all
  select second_choice, 2 from public.votes
  union all
  select third_choice,  1 from public.votes
) ranked
group by option
order by points desc, first_votes desc;

revoke all on public.results from anon, authenticated;
