export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_MIN_MOMENTUM = 20;

export function getMomentumClaimPoints(momentum) {
  const value = Math.max(0, Number(momentum) || 0);

  if (value >= 80) return 4;
  if (value >= 60) return 3;
  if (value >= 40) return 2;
  if (value >= 20) return 1;
  return 0;
}

export function getClaimPoints(champion, currentTurn) {
  const momentum = Math.max(0, Number(champion?.momentum) || 0);

  if (momentum < CLAIM_MIN_MOMENTUM) {
    return 0;
  }

  const momentumPoints = getMomentumClaimPoints(momentum);
  const fieldEntryTurn = Number.isFinite(champion?.runtime?.fieldEntryTurn)
    ? Number(champion.runtime.fieldEntryTurn)
    : Number(currentTurn) || 0;
  const turnsInField = Math.max(0, Number(currentTurn) - fieldEntryTurn);

  return Math.min(7, momentumPoints + turnsInField);
}

export function getClaimPointsFromMomentum(momentum) {
  return getMomentumClaimPoints(momentum);
}
