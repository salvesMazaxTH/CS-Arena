// shared/data/emblems/ocean_grace.js

import { grantMaxHPPercent, isEmblemBeneficiary } from "./emblemGrants.js";

export const oceanGrace = {
  key: "ocean_grace",
  name: "Emblem of the Ocean's Grace",

  healingBonusPercent: 30,
  maxHPBonusPercent: 5,

  requirements: {
    elementalAffinity: {
      element: "water",
      count: 3,
    },
  },

  description() {
    return {
      en: `Increases all healing performed or received by your team by <b>${this.healingBonusPercent}%</b> and grants <b>+${this.maxHPBonusPercent}%</b> bonus <b>Max HP</b> to allied champions when entering combat.`,
      pt: `Aumenta em <b>${this.healingBonusPercent}%</b> toda a cura realizada ou recebida pela sua equipe e concede <b>+${this.maxHPBonusPercent}%</b> de <b>HP Máximo</b> adicional aos campeões aliados ao entrarem em combate.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;

    grantMaxHPPercent(champion, this.maxHPBonusPercent, context);

    return true;
  },

  onBeforeHealing({ healSrc, healTarget, amount, owner }) {
    if (!amount || amount <= 0) return;

    if (
      healSrc?.team === owner?.team ||
      healTarget?.team === owner?.team
    ) {
      return {
        amount: Math.round(
          amount * (1 + this.healingBonusPercent / 100),
        ),
      };
    }
  },
};