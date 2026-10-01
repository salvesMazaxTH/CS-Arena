// shared/data/emblems/brawler_fury.js

import { championHasClass } from "../championClasses.js";
import { grantStats } from "./emblemGrants.js";

export const brawlerFury = {
  key: "brawler_fury",
  name: "Emblem of the Apex Brawler",
  attackBonus: 15,
  criticalBonus: 5,

  requirements: {
    classKey: [{ key: "brawler", count: 3 }],
  },

  description() {
    return {
      en: `Your Brawler class champions gain <b>+${this.attackBonus}</b> <b>Attack</b> and <b>+${this.criticalBonus}%</b> <b>Critical Chance</b>.`,
      pt: `Seus campeões da classe Lutador ganham <b>+${this.attackBonus}</b> de <b>Ataque</b> e <b>+${this.criticalBonus}%</b> de <b>Chance de Crítico</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "brawler")) return;

    grantStats(
      champion,
      { Attack: this.attackBonus, Critical: this.criticalBonus },
      context,
    );

    return true;
  },
};
