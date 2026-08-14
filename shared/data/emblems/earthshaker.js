export const earthshaker = {
  key: "earthshaker",
  name: "Emblem of the Earthshaker",

  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 5,
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
    if (!owner?.team) return;

    const allChampions =
      context?.allChampions instanceof Map
        ? [...context.allChampions.values()]
        : Array.isArray(context?.allChampions)
          ? context.allChampions
          : [];

    for (const champion of allChampions) {
      if (!champion || champion.team !== owner.team) continue;
      if (!champion.modifyStat) continue;

      champion.modifyStat({
        statName: "Defense",
        amount: 25,
        context,
        isPermanent: true,
      });
    }
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
