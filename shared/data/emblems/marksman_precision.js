// shared/data/emblems/marksman_precision.js

import { championHasClass } from "../championClasses.js";

export const marksmanPrecision = {
  key: "marksman_precision",
  name: "Emblem of Deadeye Precision",
  attackBonus: 20,
  criticalBonus: 8,

  requirements: {
    classKey: {
      key: "marksman",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Marksman class champions gain +${this.attackBonus} Attack and +${this.criticalBonus}% Critical Chance.`,
      pt: `Seus campeões da classe Atirador ganham +${this.attackBonus} de Ataque e +${this.criticalBonus}% de Chance de Crítico.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "marksman")) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._marksmanPrecisionApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._marksmanPrecisionApplied = true;

    // Apply buff only to this specific champion
    if (champion.modifyStat) {
      champion.modifyStat({
        statName: "Attack",
        amount: this.attackBonus,
        context,
        isPermanent: true,
      });
      champion.modifyStat({
        statName: "Critical",
        amount: this.criticalBonus,
        context,
        isPermanent: true,
      });
    }
  },
};
