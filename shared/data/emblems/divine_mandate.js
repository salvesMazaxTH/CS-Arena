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
    return `Your divinity champions deal ${this.bonusDmgPercent}% bonus damage to enemies with a lower HP percentage than their own, and take ${this.damageReductionPercent}% less damage while at or above ${Math.round(this.unshakenThreshold * 100)}% HP.`;
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

    console.log("[DIVINE MANDATE - Judgement] Bonus applied:", {
      attacker: attacker?.name,
      defender: defender?.name,
      attackerHPPercent: hpPercent(attacker).toFixed(2),
      defenderHPPercent: hpPercent(defender).toFixed(2),
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

    if (!isDivinity(defender)) return;

    // The divine form only holds while it is still mostly intact.
    if (hpPercent(defender) < this.unshakenThreshold) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    const newDamage = Number(damage) - reduction;

    console.log("[DIVINE MANDATE - Unshaken Form] Reduction applied:", {
      defender: defender?.name,
      attacker: attacker?.name,
      defenderHPPercent: hpPercent(defender).toFixed(2),
      before: damage,
      reduction: reduction.toFixed(2),
      after: newDamage.toFixed(2),
    });

    return {
      damage: newDamage,
    };
  },
};
