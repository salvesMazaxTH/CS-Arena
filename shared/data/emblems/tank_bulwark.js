// shared/data/emblems/tank_bulwark.js

import { championHasClass } from "../championClasses.js";
import { grantStats, grantMaxHPPercent } from "./emblemGrants.js";

export const tankBulwark = {
  key: "tank_bulwark",
  name: "Emblem of the Titan's Bulwark",
  defenseBonus: 20,
  maxHPBonusPercent: 5,

  requirements: {
    classKey: [{ key: "tank", count: 5 }],
  },

  description() {
    return {
      en: `Your Tank class champions gain +${this.defenseBonus} Defense and +${this.maxHPBonusPercent}% Max HP.`,
      pt: `Seus campeões da classe Tanque ganham +${this.defenseBonus} de Defesa e +${this.maxHPBonusPercent}% de HP Máximo.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "tank")) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);
    grantMaxHPPercent(champion, this.maxHPBonusPercent, context);
  },
};
