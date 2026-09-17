export const CLAIM_ACTION_KEY = "claim";
export const CLAIM_BASE_POINTS = 1;
export const CLAIM_MOMENTUM_MILESTONES = [35, 60, 80];
export const CLAIM_MAX_POINTS = 6;
// Minions are cheaper targets: their CLAIM (and what their death concedes) caps at 3.
export const CLAIM_MAX_POINTS_MINION = 3;

export const CLAIM_DESCRIPTION =
  `Earns you match points instead of acting. Every champion starts at ${CLAIM_BASE_POINTS} point ` +
  "and permanently gains 1 more the first time its Momentum ever reaches " +
  `${CLAIM_MOMENTUM_MILESTONES.join(", ")} — spending Momentum never takes a point back — ` +
  `plus 1 for every 2 turns this champion has spent on the field, up to ${CLAIM_MAX_POINTS}.`;

export function getClaimMaxPoints(champion) {
  return champion?.entityType === "minion"
    ? CLAIM_MAX_POINTS_MINION
    : CLAIM_MAX_POINTS;
}

export function getMomentumMilestonePoints(momentumPeak) {
  const peak = Math.max(0, Number(momentumPeak) || 0);
  return CLAIM_MOMENTUM_MILESTONES.filter((milestone) => peak >= milestone).length;
}

export function getClaimPoints(champion, currentTurn) {
  const momentumPeak = Math.max(0, Number(champion?.momentumPeak) || 0);
  const basePoints = CLAIM_BASE_POINTS + getMomentumMilestonePoints(momentumPeak);

  const fieldEntryTurn = Number.isFinite(champion?.runtime?.fieldEntryTurn)
    ? Number(champion.runtime.fieldEntryTurn)
    : Number(currentTurn) || 0;
  const turnsInField = Math.max(0, Number(currentTurn) - fieldEntryTurn);
  // One point for every two turns spent on the field.
  const fieldPoints = Math.floor(turnsInField / 2);

  return Math.min(getClaimMaxPoints(champion), basePoints + fieldPoints);
}
