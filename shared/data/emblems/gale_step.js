// shared/data/emblems/gale_step.js

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
      en: `Your champions gain +${this.evasionBonus} Evasion when entering combat.`,
      pt: `Seus campeões ganham +${this.evasionBonus} de Esquiva ao entrar em combate.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;

    if (champion.runtime?._galeStepApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._galeStepApplied = true;

    champion.modifyStat?.({
      statName: "Evasion",
      amount: this.evasionBonus,
      context,
      isPermanent: true,
    });
  },
};
