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
      en: `Your Brawler class champions gain +${this.attackBonus} Attack and +${this.criticalBonus}% Critical Chance.`,
      pt: `Seus campeões da classe Lutador ganham +${this.attackBonus} de Ataque e +${this.criticalBonus}% de Chance de Crítico.`,
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
  },
};
