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
    return {
      en: `Your human champions deal ${this.bonusDmgPercent}% bonus damage to non-human enemies and take ${this.damageReductionPercent}% less damage (except Absolute Damage) from enemies with higher Attack than them.`,
      pt: `Seus campeões humanos causam ${this.bonusDmgPercent}% de dano adicional a inimigos não humanos e sofrem ${this.damageReductionPercent}% menos dano (exceto Dano Absoluto) de inimigos com Ataque maior que o seu.`,
    };
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

    return {
      damage: newDamage,
    };
  },
};
