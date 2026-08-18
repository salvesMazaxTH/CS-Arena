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
    return "Seus campeões recebem +25 Defesa e são imunes a efeitos de controle.";
  },

  hookScope: {
    onChampionAdded: "owner",
    onStatusEffectIncoming: "target",
  },

  onChampionAdded({ owner, context }) {
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;
    if (!owner.modifyStat) return;

    // Check if already applied to this champion
    if (owner.runtime?._earthShakerApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._earthShakerApplied = true;

    // Apply buff only to this specific champion
    owner.modifyStat({
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
      message: `<b>[Emblem — Earthshaker]</b> ${target.name} é imune a efeitos de controle!`,
    };
  },
};
