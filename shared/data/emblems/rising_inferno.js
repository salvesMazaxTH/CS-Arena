// shared/data/emblems/rising_inferno.js

export const risingInferno = {
  key: "rising_inferno",
  name: "Emblem of the Rising Inferno",
  maxHPBonusPercent: 15,

  requirements: {
    elementalAffinity: {
      element: "fire",
      count: 5,
    },
  },

  description() {
    return `Fire that finds fire does not start over — it climbs what is already lit. Your Fire damage against a Burning enemy deals bonus damage equal to ${this.maxHPBonusPercent}% of that enemy's maximum HP.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (element !== "fire") return;
    if (!defender.hasStatusEffect("burning")) return;

    const bonus = Math.floor(defender.maxHP * (this.maxHPBonusPercent / 100));
    if (bonus <= 0) return;

    return {
      bonusDamage: bonus,
      log: `<b>[Emblem — Rising Inferno]</b> the flames already on ${defender.name} feed the strike for ${bonus} bonus damage.`,
    };
  },
};
