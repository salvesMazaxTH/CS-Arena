// A team earns a star at the end of each of these turns if it leads (or ties)
// on points; the first team to STARS_TO_WIN stars ends the match.
export const STAR_CHECKPOINT_TURNS = [6, 9, 12, 15, 18];
export const STARS_TO_WIN = 3;
// The first team to reach this score earns one extra star, once per match
// (both teams when they reach it in the same turn); reaching it first also
// breaks a tie on stars.
export const STAR_SCORE_THRESHOLD = 60;
export const GENERIC_SCORE_HALVING_THRESHOLD = 53;
// The arena draws each team as rows of this many combat slots; adjacency never crosses a row.
export const ARENA_ROW_SIZE = 4;

// everyTurn is the edit-mode switch that makes every turn a checkpoint.
export function isStarCheckpointTurn(turn, { everyTurn = false } = {}) {
  return everyTurn || STAR_CHECKPOINT_TURNS.includes(turn);
}

/** The first checkpoint turn at or after `turn`, or null once none is left. */
export function nextStarCheckpointTurn(turn, { everyTurn = false } = {}) {
  if (everyTurn) return turn;
  return STAR_CHECKPOINT_TURNS.find((checkpoint) => checkpoint >= turn) ?? null;
}

// Generic/global scoring (kills, CLAIM) is halved, rounded up, but only for
// the slice of the award that lands at or past the halving threshold — the
// slice that would have landed below it is untouched. Champion-kit scoring
// (registerScore) is untouched by this rule entirely.
export function applyGenericScoreHalving(currentScore, amount) {
  const current = Number(currentScore) || 0;
  const awarded = Number(amount) || 0;

  const untaxed = Math.max(0, Math.min(awarded, GENERIC_SCORE_HALVING_THRESHOLD - current));
  const taxed = awarded - untaxed;

  return untaxed + Math.ceil(taxed / 2);
}
