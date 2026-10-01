// shared/data/emblems/enchanter_ward.js

import { championHasClass } from "../championClasses.js";
import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";

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
      en: `Your Enchanter class champions gain <b>+${this.evasionBonus}</b> <b>Evasion</b> and their healing effectiveness is increased by <b>${this.healingBonusPercent}%</b>.`,
      pt: `Seus campeões da classe Encantador ganham <b>+${this.evasionBonus}</b> de <b>Esquiva</b> e a eficácia de suas curas aumenta em <b>${this.healingBonusPercent}%</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;
    if (!championHasClass(champion, "enchanter")) return;

    grantStats(champion, { Evasion: this.evasionBonus }, context);

    return true;
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
