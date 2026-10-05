-- Caps every account at 25 custom teams (prebuilt teams are not stored here).
-- Mirrors TeamStore.maxCustomTeams on the client; keep the two in step.
create or replace function public.enforce_custom_team_limit()
returns trigger
language plpgsql
as $$
begin
  -- Saves go through upsert, which fires this trigger even when the row
  -- already exists; only a genuinely new team counts against the cap.
  if exists (select 1 from public.teams where id = new.id) then
    return new;
  end if;
  if (select count(*) from public.teams where user_id = new.user_id) >= 25 then
    raise exception 'custom team limit reached (25)';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_limit on public.teams;
create trigger teams_limit
  before insert on public.teams
  for each row execute function public.enforce_custom_team_limit();
