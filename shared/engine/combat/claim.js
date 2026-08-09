export const CLAIM_ACTION_KEY = "claim";

export function getClaimPointsFromUltMeter(ultMeter) {
  const value = Math.max(0, Number(ultMeter) || 0);

  return Math.min(4, Math.floor(value / 4));
}
