-- Champion Showdown Arena - the whole database in its own "csa" schema.
-- Lets CSA share a Supabase project with another game without clashing:
-- every CSA table, view and function lives in csa, never in public.
-- Built from schema.sql plus migrations 001-004. Paste the whole file into
-- the SQL Editor and run it once; it is safe to re-run.
-- Afterwards add "csa" under Settings > API > Exposed schemas.

create schema if not exists csa;
set search_path = csa, extensions, public;

-- ============================================================
-- From supabase/schema.sql
-- ============================================================
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

-- Overall picture: how many matches were decisive vs. draws. Superseded by
-- migrations/002_forms_and_player_profiles.sql, which drops the per-side
-- columns: turns resolve simultaneously and each player sees themselves as
-- team 1, so the side means nothing.
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
-- Superseded by migrations/002_forms_and_player_profiles.sql, which adds one
-- row per transformation form.
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
-- Superseded by migrations/002_forms_and_player_profiles.sql, which appends
-- decisive_matches.
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

-- Win rate per player username. Superseded by migrations/001_auth_profiles_teams.sql,
-- which regroups it by account; run that migration after this file.
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
grant usage on schema csa to anon;
grant select on
  v_overall_summary,
  v_champion_overall,
  v_emblem_winrate,
  v_comp_winrate,
  v_player_winrate
to anon;

-- ============================================================
-- From supabase/migrations/001_auth_profiles_teams.sql
-- ============================================================
-- Champion Showdown Arena - accounts, display names and saved teams
-- Run AFTER supabase/schema.sql, in the Supabase SQL Editor. Safe to re-run.
-- Requires the Google provider to be enabled under Authentication > Providers.

-- One profile per Supabase Auth user; this is the "player" everything hangs from.
create table if not exists csa.profiles (
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
  on csa.profiles (lower(display_name));

-- Custom teams, per account. Ids are the client's generateId("team") strings.
create table if not exists csa.teams (
  id text primary key,
  user_id uuid not null references csa.profiles(id) on delete cascade,
  name text not null,
  tagline text not null default '',
  champions text[] not null default '{}',
  emblems text[] not null default '{}',
  derived_from text,
  updated_at bigint not null default 0,
  constraint teams_champions_max check (cardinality(champions) <= 8),
  constraint teams_emblems_max check (cardinality(emblems) <= 2)
);

create index if not exists teams_user_idx on csa.teams (user_id);

-- Teams first saved in edit mode; the client lists them only while it is on.
alter table csa.teams
  add column if not exists edit_mode boolean not null default false;

-- Ties match history to the account; null for matches played before accounts.
alter table csa.match_players
  add column if not exists user_id uuid references csa.profiles(id) on delete set null;

create index if not exists match_players_user_idx on csa.match_players (user_id);

alter table csa.profiles enable row level security;
alter table csa.teams enable row level security;

drop policy if exists profiles_read on csa.profiles;
drop policy if exists profiles_insert on csa.profiles;
drop policy if exists profiles_update on csa.profiles;
drop policy if exists teams_own on csa.teams;

-- Display names are public (rankings, availability check).
create policy profiles_read on csa.profiles
  for select using (true);
create policy profiles_insert on csa.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on csa.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy teams_own on csa.teams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Player ranking now groups by account, showing the current display name.
-- Matches from before accounts keep grouping by their old username.
drop view if exists csa.v_player_winrate;
create view csa.v_player_winrate as
select
  coalesce(pr.display_name, p.username) as username,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate
from csa.match_players p
join csa.matches m on m.id = p.match_id
left join csa.profiles pr on pr.id = p.user_id
group by coalesce(p.user_id::text, 'legacy:' || p.username), coalesce(pr.display_name, p.username)
order by matches_played desc;

grant select on csa.v_player_winrate to anon;
grant select on csa.profiles to anon;

-- After you and your brother have each logged in once, attach the old
-- username-only history to your accounts (replace the values, run once each):
--
-- update csa.match_players
--   set user_id = (select id from csa.profiles where display_name = 'YourNewName')
--   where username = 'YourOldName' and user_id is null;

-- ============================================================
-- From supabase/migrations/002_forms_and_player_profiles.sql
-- ============================================================
-- Champion Showdown Arena - transformation rows and player profiles
-- Run AFTER supabase/migrations/001_auth_profiles_teams.sql, in the Supabase
-- SQL Editor. Safe to re-run.
-- Run it BEFORE the next match: the server now writes form_of, and an insert
-- naming a column the table lacks fails, losing that match's champion stats.

-- A transformation (Lord of the Shadowflame, Lana's dinosaur...) scores under
-- its own champion_key, and form_of names the drafted champion that took it.
-- Null on the drafted form's own row and on minions.
alter table csa.match_champion_stats
  add column if not exists form_of text;

-- Decisive matches vs. draws. No per-side columns: turns resolve
-- simultaneously and each player sees themselves as team 1, so the side a
-- player lands on means nothing.
drop view if exists csa.v_overall_summary;
create view csa.v_overall_summary as
select
  count(*) as total_matches,
  count(*) filter (where winner_team is not null) as decisive_matches,
  count(*) filter (where winner_team is null) as draws
from csa.matches;

-- One row per drafted champion (form_of null), plus one row per form a
-- drafted champion transformed into (form_of = that champion). A form is
-- never drafted, so its roster columns are null.
drop view if exists csa.v_champion_overall;
create view csa.v_champion_overall as
with roster as (
  select
    c.champion_key,
    count(*) as matches_in_roster,
    count(*) filter (where m.winner_team is not null) as decisive_in_roster,
    count(*) filter (where p.team = m.winner_team) as roster_wins
  from csa.match_players p
  join csa.matches m on m.id = p.match_id
  cross join lateral unnest(p.champion_keys) as c(champion_key)
  group by c.champion_key
),
materialized as (
  select
    s.champion_key,
    s.form_of,
    count(*) as matches_materialized,
    count(*) filter (where m.winner_team is not null) as decisive_materialized,
    count(*) filter (where s.team = m.winner_team) as materialized_wins,
    sum(s.damage) as total_damage,
    sum(s.healing_done) as total_healing_done,
    sum(s.healing_received) as total_healing_received,
    sum(s.raw_taken) as total_raw_taken,
    sum(s.damage_mitigated) as total_damage_mitigated,
    sum(s.points) as total_points
  from csa.match_champion_stats s
  join csa.matches m on m.id = s.match_id
  group by s.champion_key, s.form_of
)
select
  r.champion_key,
  null::text as form_of,
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
left join materialized mz
  on mz.champion_key = r.champion_key and mz.form_of is null
union all
select
  mz.champion_key,
  mz.form_of,
  null,
  null,
  null,
  mz.matches_materialized,
  mz.materialized_wins,
  round(
    mz.materialized_wins::numeric / nullif(mz.decisive_materialized, 0),
    4
  ),
  mz.total_damage,
  mz.total_healing_done,
  mz.total_healing_received,
  mz.total_raw_taken,
  mz.total_damage_mitigated,
  mz.total_points
from materialized mz
where mz.form_of is not null
order by matches_in_roster desc nulls last, matches_materialized desc;

-- Same as before plus decisive_matches, so the page can merge comps stored
-- in a non-canonical order without counting their draws as losses.
create or replace view csa.v_comp_winrate as
select
  p.comp_key,
  count(*) as matches_played,
  count(*) filter (where p.team = m.winner_team) as wins,
  round(
    count(*) filter (where p.team = m.winner_team)::numeric
      / nullif(count(*) filter (where m.winner_team is not null), 0),
    4
  ) as win_rate,
  count(*) filter (where m.winner_team is not null) as decisive_matches
from csa.match_players p
join csa.matches m on m.id = p.match_id
group by p.comp_key
order by matches_played desc;

-- One row per player (account, or old username for pre-account matches) with
-- their record, the two drafted champions they put on the field most and the comp
-- they played most. favorite_team_name is the name of one of their saved
-- teams holding exactly that comp, if any.
drop view if exists csa.v_player_profile;
create view csa.v_player_profile as
with appearances as (
  select
    p.id as match_player_id,
    coalesce(p.user_id::text, 'legacy:' || p.username) as player_key,
    p.user_id,
    coalesce(pr.display_name, p.username) as username,
    p.team,
    m.winner_team,
    p.champion_keys,
    -- Older rows may hold the comp in pick order.
    array_to_string(
      array(
        select k
        from unnest(string_to_array(p.comp_key, '|')) as k
        where k <> ''
        order by k collate "C"
      ),
      '|'
    ) as comp_key
  from csa.match_players p
  join csa.matches m on m.id = p.match_id
  left join csa.profiles pr on pr.id = p.user_id
),
totals as (
  select
    player_key,
    username,
    count(*) as matches_played,
    count(*) filter (where team = winner_team) as wins,
    count(*) filter (where winner_team is not null) as decisive_matches
  from appearances
  group by player_key, username
),
champion_use as (
  select
    a.player_key,
    c.champion_key,
    count(*) as times_in_roster,
    count(*) filter (where a.team = a.winner_team) as roster_wins,
    count(*) filter (where a.winner_team is not null) as roster_decisive,
    count(*) filter (
      where exists (
        select 1
        from csa.match_champion_stats s
        where s.match_player_id = a.match_player_id
          and coalesce(s.form_of, s.champion_key) = c.champion_key
      )
    ) as times_on_field,
    count(*) filter (
      where a.winner_team is not null
        and exists (
          select 1
          from csa.match_champion_stats s
          where s.match_player_id = a.match_player_id
            and coalesce(s.form_of, s.champion_key) = c.champion_key
        )
    ) as field_decisive,
    count(*) filter (
      where a.team = a.winner_team
        and exists (
          select 1
          from csa.match_champion_stats s
          where s.match_player_id = a.match_player_id
            and coalesce(s.form_of, s.champion_key) = c.champion_key
        )
    ) as field_wins
  from appearances a
  cross join lateral unnest(a.champion_keys) as c(champion_key)
  group by a.player_key, c.champion_key
),
-- Two per player: most matches on the field, then most in the roster, then
-- best win rate on the field, then best in the roster, then alphabetical.
ranked_champions as (
  select
    cu.*,
    row_number() over (
      partition by cu.player_key
      order by
        cu.times_on_field desc,
        cu.times_in_roster desc,
        cu.field_wins::numeric / nullif(cu.field_decisive, 0) desc nulls last,
        cu.roster_wins::numeric / nullif(cu.roster_decisive, 0) desc nulls last,
        cu.champion_key collate "C"
    ) as rank
  from champion_use cu
),
favorite_champions as (
  select
    player_key,
    array_agg(champion_key order by rank) as champion_keys,
    jsonb_agg(
      jsonb_build_object(
        'champion_key', champion_key,
        'on_field', times_on_field,
        'in_roster', times_in_roster
      )
      order by rank
    ) as champions
  from ranked_champions
  where rank <= 2
  group by player_key
),
comp_use as (
  select
    player_key,
    user_id,
    comp_key,
    count(*) as matches_played,
    count(*) filter (where team = winner_team) as wins,
    count(*) filter (where winner_team is not null) as decisive_matches
  from appearances
  group by player_key, user_id, comp_key
),
-- Matches, then wins, then how many of the player's favorite champions the
-- comp holds, then alphabetical.
favorite_comp as (
  select distinct on (cu.player_key) cu.*
  from comp_use cu
  left join favorite_champions fcs on fcs.player_key = cu.player_key
  order by
    cu.player_key,
    cu.matches_played desc,
    cu.wins desc,
    (
      select count(*)
      from unnest(string_to_array(cu.comp_key, '|')) as k
      where k = any (coalesce(fcs.champion_keys, '{}'))
    ) desc,
    cu.comp_key
)
select
  t.player_key,
  t.username,
  t.matches_played,
  t.wins,
  round(t.wins::numeric / nullif(t.decisive_matches, 0), 4) as win_rate,
  fcs.champions as favorite_champions,
  fcomp.comp_key as favorite_comp_key,
  fcomp.matches_played as favorite_comp_matches,
  fcomp.wins as favorite_comp_wins,
  round(
    fcomp.wins::numeric / nullif(fcomp.decisive_matches, 0),
    4
  ) as favorite_comp_win_rate,
  (
    select tm.name
    from csa.teams tm
    where tm.user_id = fcomp.user_id
      and array_to_string(
        array(select k from unnest(tm.champions) as k order by k collate "C"),
        '|'
      ) = fcomp.comp_key
    order by tm.updated_at desc
    limit 1
  ) as favorite_team_name
from totals t
left join favorite_champions fcs on fcs.player_key = t.player_key
left join favorite_comp fcomp on fcomp.player_key = t.player_key
order by t.wins desc, t.matches_played desc;

grant select on
  csa.v_overall_summary,
  csa.v_champion_overall,
  csa.v_comp_winrate,
  csa.v_player_profile
to anon;

-- ============================================================
-- From supabase/migrations/003_custom_team_limit.sql
-- ============================================================
-- Caps every account at 25 custom teams (prebuilt teams are not stored here).
-- Mirrors TeamStore.maxCustomTeams on the client; keep the two in step.
create or replace function csa.enforce_custom_team_limit()
returns trigger
language plpgsql
as $$
begin
  -- Saves go through upsert, which fires this trigger even when the row
  -- already exists; only a genuinely new team counts against the cap.
  if exists (select 1 from csa.teams where id = new.id) then
    return new;
  end if;
  if (select count(*) from csa.teams where user_id = new.user_id) >= 25 then
    raise exception 'custom team limit reached (25)';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_limit on csa.teams;
create trigger teams_limit
  before insert on csa.teams
  for each row execute function csa.enforce_custom_team_limit();

-- ============================================================
-- From supabase/migrations/004_team_match_stats.sql
-- ============================================================
-- Per-team match stats: credit each recorded match to the saved team used.
alter table csa.match_players add column if not exists team_id text;

create index if not exists match_players_user_team_idx
  on csa.match_players (user_id, team_id);

-- The match tables are service_role only, so the caller reads its own
-- per-team totals through this function.
create or replace function csa.my_team_stats()
returns table (team_id text, matches bigint, wins bigint, losses bigint, draws bigint)
language sql
stable
security definer
set search_path = csa
as $$
  select
    p.team_id,
    count(*) as matches,
    count(*) filter (where p.team = m.winner_team) as wins,
    count(*) filter (where m.winner_team is not null and p.team <> m.winner_team) as losses,
    count(*) filter (where m.winner_team is null) as draws
  from csa.match_players p
  join csa.matches m on m.id = p.match_id
  where p.user_id = auth.uid() and p.team_id is not null
  group by p.team_id;
$$;

revoke all on function csa.my_team_stats() from public;
grant execute on function csa.my_team_stats() to authenticated;

-- ============================================================
-- Privileges. A new schema gets none of the defaults public has, so the API
-- roles are granted here what they had there.
-- ============================================================
grant usage on schema csa to anon, authenticated, service_role;

-- The server writes match history and verifies tokens as service_role.
grant all on all tables in schema csa to service_role;
grant all on all sequences in schema csa to service_role;
grant all on all functions in schema csa to service_role;

-- Signed-in players manage their own profile and teams (RLS still applies).
grant select, insert, update, delete on csa.profiles, csa.teams to authenticated;

-- The read-only aggregate views, for signed-in players as well as anon.
grant select on
  csa.v_overall_summary,
  csa.v_champion_overall,
  csa.v_emblem_winrate,
  csa.v_comp_winrate,
  csa.v_player_winrate,
  csa.v_player_profile
to authenticated;
