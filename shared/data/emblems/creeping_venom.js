// shared/data/emblems/creeping_venom.js

export const creepingVenom = {
  key: "creeping_venom",
  name: "Emblem of the Creeping Venom",
  bonusDmg: 25,

  requirements: {
    elementalAffinity: {
      element: "poison",
      count: 3,
    },
  },

  description() {
    return `Your Poison attacks deal ${this.bonusDmg} bonus damage to Poisoned enemies.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (element !== "poison") return;
    if (!defender.hasStatusEffect("poisoned")) return;

    return {
      bonusDamage: this.bonusDmg,
    };
  },
};
