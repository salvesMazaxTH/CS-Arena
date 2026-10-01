// shared/data/emblems/ocean_grace.js

import { grantMaxHPPercent } from "./emblemGrants.js";

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
      en: `Increases all healing performed or received by your team by +${this.healingBonusPercent}% and grants +${this.maxHPBonusPercent}% bonus Max HP to allied champions when entering combat.`,
      pt: `Aumenta em +${this.healingBonusPercent}% toda a cura realizada ou recebida pela sua equipe e concede +${this.maxHPBonusPercent}% de HP Máximo adicional aos campeões aliados ao entrarem em combate.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    grantMaxHPPercent(champion, this.maxHPBonusPercent, context);
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