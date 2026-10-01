// shared/data/emblems/silent_blade.js

import { championHasClass } from "../championClasses.js";
import { grantStats } from "./emblemGrants.js";

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
      en: `Your Assassin class champions gain +${this.speedBonus} Speed and +${this.criticalBonus}% Critical Chance.`,
      pt: `Seus campeões da classe Assassino ganham +${this.speedBonus} de Velocidade e +${this.criticalBonus}% de Chance de Crítico.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "assassin")) return;

    grantStats(
      champion,
      { Speed: this.speedBonus, Critical: this.criticalBonus },
      context,
    );
  },
};
