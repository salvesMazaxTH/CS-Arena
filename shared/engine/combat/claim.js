export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_MIN_ULT_METER = 4;

export function getClaimPointsFromUltMeter(ultMeter) {
  const value = Math.max(0, Number(ultMeter) || 0);

  return Math.min(4, Math.floor(value / 4));
}
