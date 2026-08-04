export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_ULT_COST = 9;

export function getClaimPointsFromMissingHP(missingHP) {
  const value = Math.max(0, Number(missingHP) || 0);

  if (value >= 165) return 1;
  if (value >= 75) return 2;
  if (value >= 50) return 3;
  return 4;
}