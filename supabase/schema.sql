-- Champion Showdown Arena - internal match analytics
-- Paste this whole file into the Supabase SQL Editor and run it once.

create extension if not exists pgcrypto;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  winner_team smallint check (winner_team in (1, 2)), -- null = draw
  turn_count integer not null default 0,
  score_team1 integer not null default 0,
  score_team2 integer not null default 0
);

create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team smallint not null check (team in (1, 2)),
  username text not null,
  champion_keys text[] not null default '{}',
  emblem_keys text[] not null default '{}',
  comp_key text not null
);

create table if not exists match_champion_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  match_player_id uuid not null references match_players(id) on delete cascade,
  team smallint not null check (team in (1, 2)),
  champion_key text not null,
  damage numeric not null default 0,
  healing_received numeric not null default 0,
  healing_done numeric not null default 0,
  raw_taken numeric not null default 0,
  damage_mitigated numeric not null default 0,
  points numeric not null default 0
);

create index if not exists idx_match_players_match_id on match_players(match_id);
create index if not exists idx_match_players_comp_key on match_players(comp_key);
create index if not exists idx_match_players_emblem_keys on match_players using gin(emblem_keys);
create index if not exists idx_match_champion_stats_match_id on match_champion_stats(match_id);
create index if not exists idx_match_champion_stats_champion_key on match_champion_stats(champion_key);

-- One-time normalization: comp_key used to be built from champion_keys in
-- whatever order they were picked, so rows written before that was fixed can
-- carry a comp_key that isn't alphabetically sorted, even though every
-- insert now sorts first. Re-deriving it here makes every row
-- order-independent, so v_comp_winrate groups picks of the same lineup
-- together no matter which order the champions were picked in. Safe to
-- re-run: already-sorted rows are a no-op.
update match_players
set comp_key = (
  select string_agg(key, '|' order by key)
  from unnest(champion_keys) as key
)
where comp_key <> (
  select string_agg(key, '|' order by key)
  from unnest(champion_keys) as key
);

-- Superseded by v_champion_overall below; drop so re-running this file after
-- an earlier version stays clean.
drop view if exists v_champion_winrate;

-- Only the server (service_role, which bypasses RLS) writes; nobody else
-- gets a policy to read or write through the API. Humans read via the
-- Supabase Studio dashboard, which also bypasses RLS for the project owner
-- and any invited collaborator.
alter table matches enable row level security;
alter table match_players enable row level security;
alter table match_champion_stats enable row level security;

-- Overall picture: how many matches were decisive vs. draws, and whether
-- team 1 (which acts first) is systematically favored.
create or replace view v_overall_summary as
select
  count(*) as total_matches,
  count(*) filter (where winner_team = 1) as team1_wins,
  count(*) filter (where winner_team = 2) as team2_wins,
  count(*) filter (where winner_team is null) as draws,
  round(
    count(*) filter (where winner_team = 1)::numeric
      / nullif(count(*) filter (where winner_team is not null), 0),
    4
  ) as team1_win_rate,
  round(
    count(*) filter (where winner_team = 2)::numeric
      / nullif(count(*) filter (where winner_team is not null), 0),
    4
  ) as team2_win_rate
from matches;

-- One row per champion, all-time. Combines both win-rate readings the game
-- needs (roster = was picked into the 8-champion lineup, whether or not it
-- was ever summoned; materialized = actually took the field) with lifetime
-- stat totals, so nobody has to scan match_champion_stats match-by-match to
-- answer "how much damage has Vulnara dealt across her whole history".
create or replace view v_champion_overall as
with roster as (
  select
    c.champion_key,
    count(*) as matches_in_roster,
    count(*) filter (where m.winner_team is not null) as decisive_in_roster,
    count(*) filter (where p.team = m.winner_team) as roster_wins
  from match_players p
  join matches m on m.id = p.match_id
  cross join lateral unnest(p.champion_keys) as c(champion_key)
  group by c.champion_key
),
materialized as (
  select
    s.champion_key,
    count(*) as matches_materialized,
    count(*) filter (where m.winner_team is not null) as decisive_materialized,
    count(*) filter (where s.team = m.winner_team) as materialized_wins,
    sum(s.damage) as total_damage,
    sum(s.healing_done) as total_healing_done,
    sum(s.healing_received) as total_healing_received,
    sum(s.raw_taken) as total_raw_taken,
    sum(s.damage_mitigated) as total_damage_mitigated,
    sum(s.points) as total_points
  from match_champion_stats s
  join matches m on m.id = s.match_id
  group by s.champion_key
)
select
  r.champion_key,
  r.matches_in_roster,
  r.roster_wins,
  round(
    r.roster_wins::numeric / nullif(r.decisive_in_roster, 0),
    4
  ) as roster_win_rate,
  coalesce(mz.matches_materialized, 0) as matches_materialized,
  coalesce(mz.materialized_wins, 0) as materialized_wins,
  round(
    mz.materialized_wins::numeric / nullif(mz.decisive_materialized, 0),
    4
  ) as materialized_win_rate,
  coalesce(mz.total_damage, 0) as total_damage,
  coalesce(mz.total_healing_done, 0) as total_healing_done,
  coalesce(mz.total_healing_received, 0) as total_healing_received,
  coalesce(mz.total_raw_taken, 0) as total_raw_taken,
  coalesce(mz.total_damage_mitigated, 0) as total_damage_mitigated,
  coalesce(mz.total_points, 0) as total_points
from roster r
left join materialized mz on mz.champion_key = r.champion_key
order by r.matches_in_roster desc;

-- Win rate per emblem key (a player can carry up to 2, so this unnests).
create or replace view v_emblem_winrate as
select
  e.emblem_key,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate
from match_players p
join matches m on m.id = p.match_id
cross join lateral unnest(p.emblem_keys) as e(emblem_key)
group by e.emblem_key
order by matches_played desc;

-- Win rate per team composition (8 champion keys, order-independent).
create or replace view v_comp_winrate as
select
  p.comp_key,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate
from match_players p
join matches m on m.id = p.match_id
group by p.comp_key
order by matches_played desc;

-- Win rate per player username (no auth in the game, so this is best-effort:
-- two players sharing a display name share a row here).
create or replace view v_player_winrate as
select
  p.username,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate
from match_players p
join matches m on m.id = p.match_id
group by p.username
order by matches_played desc;

-- The static stats page reads with the anon key, which is meant to be public
-- (protection comes from what it's allowed to touch, not from hiding it).
-- It only ever gets SELECT on these read-only aggregate views — the raw
-- matches/match_players/match_champion_stats tables stay service_role-only.
grant usage on schema public to anon;
grant select on
  v_overall_summary,
  v_champion_overall,
  v_emblem_winrate,
  v_comp_winrate,
  v_player_winrate
to anon;
