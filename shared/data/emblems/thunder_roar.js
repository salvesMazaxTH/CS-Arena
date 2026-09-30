export const thunderRoar = {
  key: "thunder_roar",
  name: "Emblem of the Thunder Roar",
  speedBonus: 10,

  requirements: {
    elementalAffinity: {
      element: "lightning",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain +${this.speedBonus} Speed. The thunder's energy makes their attacks harder to evade.`,
      pt: `Seus campeões ganham +${this.speedBonus} de Velocidade. A energia do trovão torna seus ataques mais difíceis de esquivar.`,
    };
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
        amount: this.speedBonus,
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
