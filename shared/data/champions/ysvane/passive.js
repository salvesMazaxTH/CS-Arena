import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export const KEPT_RUNTIME_FLAG = "ysvaneKeptUntilTurn";
export const KEPT_DURATION = 2;

export default {
  key: "what_the_keep_holds",
  name: "What the Keep Holds",

  claimBonusPoints: 2,

  description() {
    return `Ysvane is old enough to be the vault rather than its warden, and what she wards is not allowed to slip. An ally she lays her Affliction Ward over is Kept for ${KEPT_DURATION} turn(s); when a Kept ally uses Claim the grab holds fast in the cold, and their team banks ${this.claimBonusPoints} extra point(s) from it.`;
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team !== owner.team) return;

    const keptUntil = Number(actionSource.runtime?.[KEPT_RUNTIME_FLAG] ?? 0);
    if (keptUntil <= context.currentTurn) return;

    context.registerScore({
      amount: this.claimBonusPoints,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)}'s Claim holds fast in the cold — ${this.claimBonusPoints} extra point(s).`,
    };
  },
};
