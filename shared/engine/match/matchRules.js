export const SCORE_THRESHOLD = 45;
export const GENERIC_SCORE_HALVING_THRESHOLD = 38;

// Generic/global scoring (kills, CLAIM) is halved, rounded up, once a
// player's score has reached or crossed the halving threshold. Champion-kit
// scoring (registerScore) is untouched by this rule.
export function applyGenericScoreHalving(currentScore, amount) {
  if ((Number(currentScore) || 0) < GENERIC_SCORE_HALVING_THRESHOLD) {
    return amount;
  }
  return Math.ceil(amount / 2);
}
