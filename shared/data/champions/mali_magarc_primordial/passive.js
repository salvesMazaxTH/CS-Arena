import { formatChampionName } from "../../../ui/formatters.js";
import { unrefineMagical, drainUnrefined } from "../mali_magarc/passive.js";

export default {
  key: "nothing_refined_survives",
  name: "Nothing Refined Survives Him",

  boostedAbsorbPercent: 60,
  momentumCapPerTurn: 8,

  description() {
    return `While Mali Magarc holds his true shape, nothing keeps its refinement near him. For as long as the form lasts, ${this.boostedAbsorbPercent}% of the magical damage aimed at him is stripped to raw arcane, returning up to ${this.momentumCapPerTurn} Momentum at the start of each turn.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking(payload) {
    return unrefineMagical(payload, this.boostedAbsorbPercent);
  },

  onTurnStart({ owner, context }) {
    const results = [];

    const gained = drainUnrefined(owner, { perTurnCap: this.momentumCapPerTurn });
    if (gained) {
      context?.registerDialog?.({
        message: `<b>[Passive — ${this.name}]</b> the unmade magic pours into ${formatChampionName(owner)} as ${gained} Momentum.`,
        sourceId: owner.id,
        targetId: owner.id,
      });
      results.push({
        log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} draws ${gained} Momentum out of the pooled essence.`,
      });
    }

    return results.length ? results : undefined;
  },
};
