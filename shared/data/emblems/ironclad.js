export const ironclad = {
  key: "ironclad",
  name: "Emblem of the Ironclad",

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return "Your champions gain 15% damage reduction and are immune to indirect damage.";
  },

  hookScope: {
    onChampionAdded: "owner",
    onDamageIncoming: "defender",
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
      if (!champion.applyDamageReduction) continue;

      champion.applyDamageReduction({
        amount: 15,
        type: "percent",
        duration: 9999,
        source: "Emblem of the Ironclad",
        context,
      });
    }
  },

  onDamageIncoming({ defender, damage, context, owner }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!Number.isFinite(Number(damage)) || Number(damage) <= 0) return;
    if ((context?.damageDepth ?? 0) <= 0) return;

    return {
      cancel: true,
      immune: true,
      message: `<b>[Emblem — Ironclad]</b> ${defender.name} is immune to indirect damage!`,
    };
  },
};
