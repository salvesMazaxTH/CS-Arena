// shared/data/emblems/verdant_root.js

import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";

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
    return `Your champions gain +${this.defenseBonus} Defense when entering combat and are immune to ${this.immuneStatusKeys
      .map((key) => StatusEffectsRegistry[key].name)
      .join(" and ")}.`;
  },

  hookScope: {
    onStatusEffectIncoming: "target",
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;

    if (champion.runtime?._verdantRootApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._verdantRootApplied = true;

    champion.modifyStat?.({
      statName: "Defense",
      amount: this.defenseBonus,
      context,
      isPermanent: true,
    });
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
