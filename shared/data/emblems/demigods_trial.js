// shared/data/emblems/demigods_trial.js

function isDemigod(champion) {
  if (!champion || !Array.isArray(champion.species)) return false;
  return champion.species.some(
    (s) => typeof s === "string" && s.toLowerCase() === "demigod",
  );
}

export const demigodsTrial = {
  key: "demigods_trial",
  name: "Emblem of the Demigod's Trial",
  bonusDmgPercent: 14,
  damageReductionPercent: 16,

  requirements: {
    species: {
      species: "demigod",
      count: 5,
    },
  },

  description() {
    return `Your demigod champions deal ${this.bonusDmgPercent}% bonus damage to enemies with more current HP than their own, and take ${this.damageReductionPercent}% less damage (except Absolute Damage) from enemies with a higher Max HP than their own.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onDamageIncoming: "defender",
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (!isDemigod(attacker)) return;

    // The trial is always a fight against something greater.
    if (Number(defender.HP) <= Number(attacker.HP)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    return { damage: Number(damage) + bonusDamage };
  },

  onDamageIncoming({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;
    if (defender.team !== owner.team) return;
    if (!isDemigod(defender)) return;

    if (Number(attacker.maxHP) <= Number(defender.maxHP)) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    return { damage: Number(damage) - reduction };
  },
};
