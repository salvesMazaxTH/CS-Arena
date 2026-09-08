export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_MIN_MOMENTUM = 25;
export const CLAIM_MAX_POINTS = 6;
// Minions are cheaper targets: their CLAIM (and what their death concedes) caps at 3.
export const CLAIM_MAX_POINTS_MINION = 3;

export const CLAIM_DESCRIPTION =
  "Earns you match points instead of acting. Points scale with your current " +
  "Momentum — 1, 2, or 3 at 25, 50, and 75 — plus 1 for every 2 turns this " +
  `champion has spent on the field, up to ${CLAIM_MAX_POINTS}. ` +
  `Requires ${CLAIM_MIN_MOMENTUM} Momentum.`;

export function getClaimMaxPoints(champion) {
  return champion?.entityType === "minion"
    ? CLAIM_MAX_POINTS_MINION
    : CLAIM_MAX_POINTS;
}

export function getMomentumClaimPoints(momentum) {
  const value = Math.max(0, Number(momentum) || 0);

  if (value >= 75) return 3;
  if (value >= 50) return 2;
  if (value >= 25) return 1;
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
  // One point for every two turns spent on the field.
  const fieldPoints = Math.floor(turnsInField / 2);

  return Math.min(getClaimMaxPoints(champion), momentumPoints + fieldPoints);
}

export function getClaimPointsFromMomentum(momentum) {
  return getMomentumClaimPoints(momentum);
}
