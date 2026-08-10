export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_MIN_MOMENTUM = 16;

export function getClaimPointsFromMomentum(momentum) {
  const value = Math.max(0, Number(momentum) || 0);

  return Math.min(4, Math.floor(value / 16));
}
