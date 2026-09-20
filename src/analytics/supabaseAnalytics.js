import { createClient } from "@supabase/supabase-js";

// Flags that invalidate a match for stats purposes even when `enabled` is
// false. autoLogin/autoSelection/unavailableChampions are left out: they
// affect flow/UI, not the combat numbers themselves.
const GATED_FLAGS = {
  enabled: false,
  freeCostSkills: false,
  alwaysCrit: false,
  alwaysEvade: false,
  damageOutput: null,
  executionOverride: null,
  unrestrictedSummon: false,
  actMultipleTimesPerTurn: false,
  summonWithoutSpawnProtection: false,
};

export function isEditModeClean(editMode) {
  return Object.entries(GATED_FLAGS).every(
    ([key, cleanValue]) => (editMode?.[key] ?? cleanValue) === cleanValue,
  );
}

let client = null;
let warnedMissingConfig = false;

function getClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!warnedMissingConfig) {
      console.warn(
        "[analytics] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set; match results will not be uploaded.",
      );
      warnedMissingConfig = true;
    }
    return null;
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function compKeyFor(championKeys) {
  return [...championKeys].sort().join("|");
}

/**
 * @param {object} params
 * @param {number|null} params.winnerTeam - 1, 2, or null for a draw
 * @param {number} params.turnCount
 * @param {number[]} params.scores - [scoreTeam1, scoreTeam2]
 * @param {{team:number, username:string, championKeys:string[], emblemKeys:string[]}[]} params.players
 * @param {object[]} params.championRoster - serialized champions from getMatchRosterStats(), each with a `team` and `matchStats`
 */
export async function recordMatchResult({
  winnerTeam,
  turnCount,
  scores,
  players,
  championRoster,
}) {
  const supabase = getClient();
  if (!supabase) return;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      winner_team: winnerTeam,
      turn_count: turnCount,
      score_team1: scores?.[0] || 0,
      score_team2: scores?.[1] || 0,
    })
    .select("id")
    .single();

  if (matchError) throw matchError;

  const { data: insertedPlayers, error: playersError } = await supabase
    .from("match_players")
    .insert(
      players.map((p) => ({
        match_id: match.id,
        team: p.team,
        username: p.username,
        champion_keys: p.championKeys,
        emblem_keys: p.emblemKeys,
        comp_key: compKeyFor(p.championKeys),
      })),
    )
    .select("id, team");

  if (playersError) throw playersError;

  const playerIdByTeam = new Map(insertedPlayers.map((p) => [p.team, p.id]));

  const championRows = championRoster
    .filter((champion) => playerIdByTeam.has(champion.team))
    .map((champion) => ({
      match_id: match.id,
      match_player_id: playerIdByTeam.get(champion.team),
      team: champion.team,
      champion_key: champion.championKey,
      damage: champion.matchStats?.damage || 0,
      healing_received: champion.matchStats?.healingReceived || 0,
      healing_done: champion.matchStats?.healingDone || 0,
      raw_taken: champion.matchStats?.rawTaken || 0,
      damage_mitigated: champion.matchStats?.damageMitigated || 0,
      points: champion.matchStats?.points || 0,
    }));

  if (championRows.length > 0) {
    const { error: statsError } = await supabase
      .from("match_champion_stats")
      .insert(championRows);

    if (statsError) throw statsError;
  }
}
