export const thunderRoar = {
  key: "thunder_roar",
  name: "Emblem of the Thunder Roar",

  requirements: {
    elementalAffinity: {
      element: "lightning",
      count: 2,
    },
  },

  description() {
    return "Seus campeões recebem +10 Speed. A energia do trovão faz seu ataque se tornar mais difícil de escapar.";
  },

  hookScope: {
    onChampionAdded: "owner",
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
      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Speed",
          amount: 10,
          context,
          isPermanent: true,
        });
      }

      if (Array.isArray(champion.skills)) {
        champion.skills.forEach((skill) => {
          if (!skill || typeof skill !== "object") return;
          skill.cannotBeEvaded = true;
        });
      }
    }
  },
};
