// shared/data/emblems/silent_blade.js

import { championHasClass } from "../championClasses.js";
import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";

export const silentBlade = {
  key: "silent_blade",
  name: "Emblem of the Silent Blade",
  speedBonus: 15,
  criticalBonus: 10,

  requirements: {
    classKey: [{ key: "assassin", count: 3 }],
  },

  description() {
    return {
      en: `Your Assassin class champions gain <b>+${this.speedBonus}</b> <b>Speed</b> and <b>+${this.criticalBonus}%</b> <b>Critical Chance</b>.`,
      pt: `Seus campeões da classe Assassino ganham <b>+${this.speedBonus}</b> de <b>Velocidade</b> e <b>+${this.criticalBonus}%</b> de <b>Chance de Crítico</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;
    if (!championHasClass(champion, "assassin")) return;

    grantStats(
      champion,
      { Speed: this.speedBonus, Critical: this.criticalBonus },
      context,
    );

    return true;
  },
};
