export const earthshaker = {
  key: "earthshaker",
  name: "Emblem of the Earthshaker",

  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 2,
    },
  },

  description() {
    return "Your champions gain +25 Defense and are immune to control effects.";
  },

  hookScope: {
    onStatusEffectIncoming: "target",
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!champion.modifyStat) return;

    // Check if already applied to this champion
    if (champion.runtime?._earthShakerApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._earthShakerApplied = true;

    // Apply buff only to this specific champion
    champion.modifyStat({
      statName: "Defense",
      amount: 25,
      context,
      isPermanent: true,
    });
  },

  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (!statusEffect?.subtypes) return;

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
