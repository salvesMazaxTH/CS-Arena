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
    return `Seus ataques de Fogo causam ${this.bonusDmg} de dano adicional.`;
  },

  onBeforeDmgDealing({ attacker, skill, damage, owner }) {
    console.log("[FIRE LORD] Hook chamado:", {
      owner: owner?.name,
      ownerTeam: owner?.team,
      attacker: attacker?.name,
      attackerTeam: attacker?.team,
      skill: skill?.name,
      element: skill?.element,
      damage,
    });

    if (!attacker || !skill) return;

    if (attacker.team !== owner.team) return;

    if (skill.element !== "fire") return;

    const newDamage = Number(damage) + this.bonusDmg;

    console.log("[FIRE LORD] BÔNUS APLICADO:", {
      owner: owner.name,
      before: damage,
      bonus: this.bonusDmg,
      after: newDamage,
    });

    return {
      damage: newDamage,
    };
  },
};
