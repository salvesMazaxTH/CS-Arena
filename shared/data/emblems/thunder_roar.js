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
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;

    // Check if already applied to this champion
    if (owner.runtime?._thunderRoarApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._thunderRoarApplied = true;

    // Apply buff only to this specific champion
    if (owner.modifyStat) {
      owner.modifyStat({
        statName: "Speed",
        amount: 10,
        context,
        isPermanent: true,
      });
    }

    if (Array.isArray(owner.skills)) {
      owner.skills.forEach((skill) => {
        if (!skill || typeof skill !== "object") return;
        skill.cannotBeEvaded = true;
      });
    }
  },
};
