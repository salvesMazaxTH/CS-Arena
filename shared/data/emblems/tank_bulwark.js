// shared/data/emblems/tank_bulwark.js

import { championHasClass } from "../championClasses.js";
import { grantStats, grantMaxHPPercent, isEmblemBeneficiary } from "./emblemGrants.js";

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
      en: `Your Tank class champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> and <b>+${this.maxHPBonusPercent}%</b> <b>Max HP</b>.`,
      pt: `Seus campeões da classe Tanque ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> e <b>+${this.maxHPBonusPercent}%</b> de <b>HP Máximo</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;
    if (!championHasClass(champion, "tank")) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);
    grantMaxHPPercent(champion, this.maxHPBonusPercent, context);

    return true;
  },
};
