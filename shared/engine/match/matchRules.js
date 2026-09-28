// A team earns a star at the end of each of these turns if it leads (or ties)
// on points; the first team to STARS_TO_WIN stars ends the match.
export const STAR_CHECKPOINT_TURNS = [5, 8, 11, 14, 17];
export const STARS_TO_WIN = 3;
// Reaching this score grants a one-time extra star, and whoever reached it
// first breaks a tie on stars.
export const STAR_SCORE_THRESHOLD = 60;
export const GENERIC_SCORE_HALVING_THRESHOLD = 53;
// The arena draws each team as rows of this many combat slots; adjacency never crosses a row.
export const ARENA_ROW_SIZE = 4;

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
