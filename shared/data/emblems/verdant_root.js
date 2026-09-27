// shared/data/emblems/verdant_root.js

export const verdantRoot = {
  key: "verdant_root",
  name: "Emblem of the Verdant Root",
  defenseBonus: 10,

  requirements: {
    elementalAffinity: {
      element: "plant",
      count: 3,
    },
  },

  description() {
    return `Your champions gain +${this.defenseBonus} Defense when entering combat and are immune to Poisoned and Rooted.`;
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
    if (!["poisoned", "rooted"].includes(statusEffect?.key)) return;

    return {
      cancel: true,
      message: `<b>[Emblem — Verdant Root]</b> ${target.name}'s roots shrug off the ${statusEffect.name ?? statusEffect.key}.`,
    };
  },
};
