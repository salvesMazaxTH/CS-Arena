// shared/data/emblems/gale_step.js

import { grantStats } from "./emblemGrants.js";

export const galeStep = {
  key: "gale_step",
  name: "Emblem of the Gale Step",
  evasionBonus: 10,

  requirements: {
    elementalAffinity: {
      element: "air",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>+${this.evasionBonus}</b> <b>Evasion</b> when entering combat.`,
      pt: `Seus campeões ganham <b>+${this.evasionBonus}</b> de <b>Esquiva</b> ao entrar em combate.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    grantStats(champion, { Evasion: this.evasionBonus }, context);

    return true;
  },
};
