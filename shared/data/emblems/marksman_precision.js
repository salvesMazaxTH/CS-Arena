// shared/data/emblems/marksman_precision.js

import { championHasClass } from "../championClasses.js";
import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";

export const marksmanPrecision = {
  key: "marksman_precision",
  name: "Emblem of Deadeye Precision",
  attackBonus: 20,
  criticalBonus: 8,

  requirements: {
    classKey: [{ key: "marksman", count: 3 }],
  },

  description() {
    return {
      en: `Your Marksman class champions gain <b>+${this.attackBonus}</b> <b>Attack</b> and <b>+${this.criticalBonus}%</b> <b>Critical Chance</b>.`,
      pt: `Seus campeões da classe Atirador ganham <b>+${this.attackBonus}</b> de <b>Ataque</b> e <b>+${this.criticalBonus}%</b> de <b>Chance de Crítico</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;
    if (!championHasClass(champion, "marksman")) return;

    grantStats(
      champion,
      { Attack: this.attackBonus, Critical: this.criticalBonus },
      context,
    );

    return true;
  },
};
