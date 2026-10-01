// shared/data/emblems/enchanter_ward.js

import { championHasClass } from "../championClasses.js";
import { grantStats } from "./emblemGrants.js";

export const enchanterWard = {
  key: "enchanter_ward",
  name: "Emblem of Mystic Sanctuary",
  evasionBonus: 10,
  healingBonusPercent: 15,

  requirements: {
    classKey: [{ key: "enchanter", count: 3 }],
  },

  description() {
    return {
      en: `Your Enchanter class champions gain +${this.evasionBonus} Evasion and their healing effectiveness is increased by +${this.healingBonusPercent}%.`,
      pt: `Seus campeões da classe Encantador ganham +${this.evasionBonus} de Esquiva e a eficácia de suas curas aumenta em +${this.healingBonusPercent}%.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "enchanter")) return;

    grantStats(champion, { Evasion: this.evasionBonus }, context);
  },

  onBeforeHealing({ healSrc, amount, owner }) {
    if (!amount || amount <= 0) return;
    if (healSrc?.team !== owner?.team) return;
    if (!championHasClass(healSrc, "enchanter")) return;

    return {
      amount: Math.round(amount * (1 + this.healingBonusPercent / 100)),
    };
  },
};
