// shared/data/emblems/brawler_fury.js

import { championHasClass } from "../championClasses.js";

export const brawlerFury = {
  key: "brawler_fury",
  name: "Emblem of the Apex Brawler",
  attackBonus: 15,
  criticalBonus: 5,

  requirements: {
    classKey: {
      key: "brawler",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Brawler class champions gain +${this.attackBonus} Attack and +${this.criticalBonus}% Critical Chance.`,
      pt: `Seus campeões da classe Lutador ganham +${this.attackBonus} de Ataque e +${this.criticalBonus}% de Chance de Crítico.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "brawler")) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._brawlerFuryApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._brawlerFuryApplied = true;

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
