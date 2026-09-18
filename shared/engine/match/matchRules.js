export const SCORE_THRESHOLD = 45;
export const GENERIC_SCORE_HALVING_THRESHOLD = 38;

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
