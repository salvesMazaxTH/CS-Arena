import { grantStats } from "./emblemGrants.js";

export const earthshaker = {
  key: "earthshaker",
  name: "Emblem of the Earthshaker",
  defenseBonus: 25,

  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain +${this.defenseBonus} Defense and are immune to control effects.`,
      pt: `Seus campeões ganham +${this.defenseBonus} de Defesa e são imunes a efeitos de controle.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);
  },

  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (!statusEffect?.subtypes) return;
    if (statusEffect.subtypes.includes("systemic")) return;

    const isControl =
      statusEffect.subtypes.includes("hardCC") ||
      statusEffect.subtypes.includes("softCC");

    if (!isControl) return;

    return {
      cancel: true,
      message: `<b>[Emblem — Earthshaker]</b> ${target.name} is immune to control effects!`,
    };
  },
};
