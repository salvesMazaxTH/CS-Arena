-- Champion Showdown Arena - accounts, display names and saved teams
-- Run AFTER supabase/schema.sql, in the Supabase SQL Editor. Safe to re-run.
-- Requires the Google provider to be enabled under Authentication > Providers.

-- One profile per Supabase Auth user; this is the "player" everything hangs from.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  selected_team_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 3 to 20 characters, no leading or trailing whitespace.
  constraint display_name_format check (display_name ~ '^\S(.{1,18})\S$')
);

-- Display names are unique regardless of letter case. The database is the
-- source of truth for this, so two people picking the same name at once can't
-- both win.
create unique index if not exists profiles_display_name_ci
  on public.profiles (lower(display_name));

-- Custom teams, per account. Ids are the client's generateId("team") strings.
create table if not exists public.teams (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  tagline text not null default '',
  champions text[] not null default '{}',
  emblems text[] not null default '{}',
  derived_from text,
  updated_at bigint not null default 0,
  constraint teams_champions_max check (cardinality(champions) <= 8),
  constraint teams_emblems_max check (cardinality(emblems) <= 2)
);

create index if not exists teams_user_idx on public.teams (user_id);

-- Ties match history to the account; null for matches played before accounts.
alter table public.match_players
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists match_players_user_idx on public.match_players (user_id);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists teams_own on public.teams;

-- Display names are public (rankings, availability check).
create policy profiles_read on public.profiles
  for select using (true);
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy teams_own on public.teams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Player ranking now groups by account, showing the current display name.
-- Matches from before accounts keep grouping by their old username.
drop view if exists public.v_player_winrate;
create view public.v_player_winrate as
select
  coalesce(pr.display_name, p.username) as username,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate
from public.match_players p
join public.matches m on m.id = p.match_id
left join public.profiles pr on pr.id = p.user_id
group by coalesce(p.user_id::text, 'legacy:' || p.username), coalesce(pr.display_name, p.username)
order by matches_played desc;

grant select on public.v_player_winrate to anon;
grant select on public.profiles to anon;

-- After you and your brother have each logged in once, attach the old
-- username-only history to your accounts (replace the values, run once each):
--
-- update public.match_players
--   set user_id = (select id from public.profiles where display_name = 'YourNewName')
--   where username = 'YourOldName' and user_id is null;
