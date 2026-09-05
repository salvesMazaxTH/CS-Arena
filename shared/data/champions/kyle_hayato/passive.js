import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "shadowstorm",
  name: "Shadowstorm",

  markWindow: 2,

  description() {
    return `Kyle can't stand watching someone else profit from what he wants for himself. Whenever an enemy uses CLAIM, he marks them for ${this.markWindow} turn(s) — his ultimate knows exactly what to do with a mark.`;
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team === owner.team) {
      return;
    }

    actionSource.runtime ??= {};
    actionSource.runtime.shadowstormMarkTurn = context.currentTurn;
    actionSource.runtime.shadowstormMarkPoints =
      Number(context.preActionClaimPoints) || 0;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)} claims something Kyle wanted — marked.`,
    };
  },
};
