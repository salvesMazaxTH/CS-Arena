// shared/data/emblems/humanitys_defiance.js

function isHuman(champion) {
  if (!champion || !Array.isArray(champion.species)) return false;
  return champion.species.some(
    (s) => typeof s === "string" && s.toLowerCase() === "human",
  );
}

export const humanitysDefiance = {
  key: "humanitys_defiance",
  name: "Emblem of Humanity's Defiance",
  bonusDmgPercent: 10,
  damageReductionPercent: 15,

  requirements: {
    species: {
      species: "human",
      count: 7,
    },
  },

  description() {
    return `Your human champions deal ${this.bonusDmgPercent}% bonus damage to non-human enemies and take ${this.damageReductionPercent}% less damage from enemies with higher Attack than them.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onDamageIncoming: "defender",
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender) return;

    if (attacker.team !== owner.team) return;

    // Only Human champions benefit from the Emblem.
    if (!isHuman(attacker)) return;

    // Only apply bonus if defender is non-human
    if (isHuman(defender)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    
    const newDamage = Number(damage) + bonusDamage;

    console.log("[HUMANITY'S DEFIANCE - Class Adaptation] Bonus applied:", {
      attacker: attacker?.name,
      defender: defender?.name,
      attackerClass: attacker?.classKey,
      defenderClass: defender?.classKey,
      before: damage,
      bonus: bonusDamage.toFixed(2),
      after: newDamage.toFixed(2),
    });

    return {
      damage: newDamage,
    };
  },

  onDamageIncoming({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;

    if (defender.team !== owner.team) return;

    if (!isHuman(defender)) return;

    // Only apply reduction if attacker has higher Attack stat
    if (attacker.Attack <= defender.Attack) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    const newDamage = Number(damage) - reduction;

    console.log("[HUMANITY'S DEFIANCE - Adaptive Defense] Reduction applied:", {
      defender: defender?.name,
      attacker: attacker?.name,
      defenderAttack: defender?.Attack,
      attackerAttack: attacker?.Attack,
      before: damage,
      reduction: reduction.toFixed(2),
      after: newDamage.toFixed(2),
    });

    return {
      damage: newDamage,
    };
  },
};
