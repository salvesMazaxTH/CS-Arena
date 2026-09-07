// shared/data/emblems/fire_lord.js

export const firelord = {
  key: "fire_lord",
  name: "Emblem of the Fire Lord",
  bonusDmg: 35,

  requirements: {
    elementalAffinity: {
      element: "fire",
      count: 3,
    },
  },

  description() {
    return `Your Fire attacks deal ${this.bonusDmg} bonus damage.`;
  },

  onBeforeDmgDealing({ attacker, skill, owner }) {
    if (!attacker || !skill) return;

    if (attacker.team !== owner.team) return;

    if (skill.element !== "fire") return;

    return {
      bonusDamage: this.bonusDmg,
    };
  },
};
