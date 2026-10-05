-- Per-team match stats: credit each recorded match to the saved team used.
alter table public.match_players add column if not exists team_id text;

create index if not exists match_players_user_team_idx
  on public.match_players (user_id, team_id);

-- The match tables are service_role only, so the caller reads its own
-- per-team totals through this function.
create or replace function public.my_team_stats()
returns table (team_id text, matches bigint, wins bigint, losses bigint, draws bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.team_id,
    count(*) as matches,
    count(*) filter (where p.team = m.winner_team) as wins,
    count(*) filter (where m.winner_team is not null and p.team <> m.winner_team) as losses,
    count(*) filter (where m.winner_team is null) as draws
  from public.match_players p
  join public.matches m on m.id = p.match_id
  where p.user_id = auth.uid() and p.team_id is not null
  group by p.team_id;
$$;

revoke all on function public.my_team_stats() from public;
grant execute on function public.my_team_stats() to authenticated;
