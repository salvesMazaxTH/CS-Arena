-- Champion Showdown Arena - transformation rows and player profiles
-- Run AFTER supabase/migrations/001_auth_profiles_teams.sql, in the Supabase
-- SQL Editor. Safe to re-run.
-- Run it BEFORE the next match: the server now writes form_of, and an insert
-- naming a column the table lacks fails, losing that match's champion stats.

-- A transformation (Lord of the Shadowflame, Lana's dinosaur...) scores under
-- its own champion_key, and form_of names the drafted champion that took it.
-- Null on the drafted form's own row and on minions.
alter table public.match_champion_stats
  add column if not exists form_of text;

-- Decisive matches vs. draws. No per-side columns: turns resolve
-- simultaneously and each player sees themselves as team 1, so the side a
-- player lands on means nothing.
drop view if exists public.v_overall_summary;
create view public.v_overall_summary as
select
  count(*) as total_matches,
  count(*) filter (where winner_team is not null) as decisive_matches,
  count(*) filter (where winner_team is null) as draws
from public.matches;

-- One row per drafted champion (form_of null), plus one row per form a
-- drafted champion transformed into (form_of = that champion). A form is
-- never drafted, so its roster columns are null.
drop view if exists public.v_champion_overall;
create view public.v_champion_overall as
with roster as (
  select
    c.champion_key,
    count(*) as matches_in_roster,
    count(*) filter (where m.winner_team is not null) as decisive_in_roster,
    count(*) filter (where p.team = m.winner_team) as roster_wins
  from public.match_players p
  join public.matches m on m.id = p.match_id
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
  from public.match_champion_stats s
  join public.matches m on m.id = s.match_id
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
create or replace view public.v_comp_winrate as
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
from public.match_players p
join public.matches m on m.id = p.match_id
group by p.comp_key
order by matches_played desc;

-- One row per player (account, or old username for pre-account matches) with
-- their record, the two drafted champions they put on the field most and the comp
-- they played most. favorite_team_name is the name of one of their saved
-- teams holding exactly that comp, if any.
drop view if exists public.v_player_profile;
create view public.v_player_profile as
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
  from public.match_players p
  join public.matches m on m.id = p.match_id
  left join public.profiles pr on pr.id = p.user_id
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
        from public.match_champion_stats s
        where s.match_player_id = a.match_player_id
          and coalesce(s.form_of, s.champion_key) = c.champion_key
      )
    ) as times_on_field,
    count(*) filter (
      where a.winner_team is not null
        and exists (
          select 1
          from public.match_champion_stats s
          where s.match_player_id = a.match_player_id
            and coalesce(s.form_of, s.champion_key) = c.champion_key
        )
    ) as field_decisive,
    count(*) filter (
      where a.team = a.winner_team
        and exists (
          select 1
          from public.match_champion_stats s
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
    from public.teams tm
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
  public.v_overall_summary,
  public.v_champion_overall,
  public.v_comp_winrate,
  public.v_player_profile
to anon;
