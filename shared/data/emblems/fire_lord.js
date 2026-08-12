// shared/data/emblems/fire_lord.js

export const firelord = {
  key: "fire_lord",
  name: "Emblem of the Fire Lord",
  bonusDmg: 15,

  requirements: {
    elementalAffinity: {
      element: "fire",
      count: 3,
    },
  },

  description() {
    return `Seus ataques de Fogo causam ${this.bonusDmg} de dano adicional.`;
  },

  onBeforeDmgDealing({ attacker, skill, damage, owner }) {
    if (!attacker || !skill) return;

    if (attacker.team !== owner.team) return;

    if (skill.element !== "fire") return;

    return {
      damage: Number(damage) + this.bonusDmg,
    };
  },
};
