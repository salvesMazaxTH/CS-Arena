// shared/data/emblems/divine_mandate.js

function isDivinity(champion) {
  if (!champion || !Array.isArray(champion.species)) return false;
  return champion.species.some(
    (s) => typeof s === "string" && s.toLowerCase() === "divinity",
  );
}

function hpPercent(champion) {
  const max = Number(champion?.maxHP || champion?.HP || 0);
  if (!max) return 1;
  return Number(champion?.HP || 0) / max;
}

export const divineMandate = {
  key: "divine_mandate",
  name: "Emblem of the Divine Mandate",
  bonusDmgPercent: 12,
  damageReductionPercent: 15,
  unshakenThreshold: 0.6,

  requirements: {
    species: {
      species: "divinity",
      count: 5,
    },
  },

  description() {
    const threshold = Math.round(this.unshakenThreshold * 100);
    return {
      en: `Your divinity champions deal ${this.bonusDmgPercent}% bonus damage to enemies with a lower HP percentage than their own, and take ${this.damageReductionPercent}% less damage (except Absolute Damage) while at or above ${threshold}% HP.`,
      pt: `Seus campeões divinos causam ${this.bonusDmgPercent}% de dano adicional a inimigos com porcentagem de HP menor que a sua e sofrem ${this.damageReductionPercent}% menos dano (exceto Dano Absoluto) enquanto estiverem com ${threshold}% de HP ou mais.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onDamageIncoming: "defender",
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;

    if (attacker.team !== owner.team) return;

    // Only Divinity champions benefit from the Emblem.
    if (!isDivinity(attacker)) return;

    // Judgement only falls on those already faltering.
    if (hpPercent(defender) >= hpPercent(attacker)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },

  onDamageIncoming({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;

    if (defender.team !== owner.team) return;

    if (!isDivinity(defender)) return;

    // The divine form only holds while it is still mostly intact.
    if (hpPercent(defender) < this.unshakenThreshold) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    const newDamage = Number(damage) - reduction;

    return {
      damage: newDamage,
    };
  },
};
