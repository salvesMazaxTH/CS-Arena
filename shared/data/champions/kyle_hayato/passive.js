import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "shadowstorm",
  name: "Shadowstorm",

  markWindow: 2,

  description() {
    return {
      en: `Kyle can't stand watching someone else profit from what he wants for himself. Whenever an enemy uses <b>CLAIM</b>, he marks them for <b>${this.markWindow}</b> turn(s) — his ultimate knows exactly what to do with a mark.`,
      pt: `Kyle não suporta assistir outra pessoa lucrar com o que ele quer para si. Sempre que um inimigo usa <b>CLAIM</b>, ele o marca por <b>${this.markWindow}</b> turno(s) — seu ultimate sabe exatamente o que fazer com uma marca.`,
    };
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team === owner.team) {
      return;
    }

    actionSource.runtime.shadowstormMarkUntilTurn =
      context.currentTurn + this.markWindow;
    actionSource.runtime.shadowstormMarkPoints =
      Number(context.preActionClaimPoints) || 0;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)} claims something Kyle wanted — marked.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(actionSource)} reivindica algo que Kyle queria — marcado.`,
      },
    };
  },

  clearMarks(owner, champions, { onlyStale = true, currentTurn = 0 } = {}) {
    for (const champion of champions) {
      if (champion.team === owner.team) continue;

      const until = champion.runtime.shadowstormMarkUntilTurn;
      if (until === undefined) continue;
      if (onlyStale && until > currentTurn) continue;

      delete champion.runtime.shadowstormMarkUntilTurn;
      delete champion.runtime.shadowstormMarkPoints;
    }
  },

  // Nothing else clears the mark, and a stale one would sit on the enemy's
  // portrait long after the ultimate could still spend it.
  onTurnStart({ owner, context }) {
    this.clearMarks(owner, context.aliveChampions, {
      currentTurn: context.currentTurn,
    });
  },

  // Kyle leaves the field with his sweep, so his marks have to go with him.
  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;
    this.clearMarks(owner, context.aliveChampions, { onlyStale: false });
  },
};
