// shared/data/emblems/verdant_root.js

import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";
import { grantStats } from "./emblemGrants.js";

export const verdantRoot = {
  key: "verdant_root",
  name: "Emblem of the Verdant Root",
  defenseBonus: 10,
  immuneStatusKeys: ["poisoned", "rooted"],

  requirements: {
    elementalAffinity: {
      element: "plant",
      count: 3,
    },
  },

  description() {
    const namesPt = { poisoned: "Envenenado", rooted: "Enraizado" };
    const immunitiesEn = this.immuneStatusKeys
      .map((key) => StatusEffectsRegistry[key].name)
      .join(" and ");
    const immunitiesPt = this.immuneStatusKeys
      .map((key) => namesPt[key] ?? StatusEffectsRegistry[key].name)
      .join(" e ");
    return {
      en: `Your champions gain +${this.defenseBonus} Defense when entering combat and are immune to ${immunitiesEn}.`,
      pt: `Seus campeões ganham +${this.defenseBonus} de Defesa ao entrar em combate e são imunes a ${immunitiesPt}.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);
  },

  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (!this.immuneStatusKeys.includes(statusEffect?.key)) return;

    return {
      cancel: true,
      message: `<b>[Emblem — Verdant Root]</b> ${target.name}'s roots shrug off the ${statusEffect.name ?? statusEffect.key}.`,
    };
  },
};
