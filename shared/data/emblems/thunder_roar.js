export const thunderRoar = {
  key: "thunder_roar",
  name: "Emblem of the Thunder Roar",

  requirements: {
    elementalAffinity: {
      element: "lightning",
      count: 3,
    },
  },

  description() {
    return "Your champions gain +10 Speed. The thunder's energy makes their attacks harder to evade.";
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;

    // Check if already applied to this champion
    if (champion.runtime?._thunderRoarApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._thunderRoarApplied = true;

    // Apply buff only to this specific champion
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
  },
};
