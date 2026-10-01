// shared/data/emblems/divine_mandate.js

import { championHasSpecies } from "../championTraits.js";

function hpPercent(champion) {
  return (champion.HP / champion.maxHP) * 100;
}

export const divineMandate = {
  key: "divine_mandate",
  name: "Emblem of the Divine Mandate",
  bonusDmgPercent: 12,
  damageReductionPercent: 15,
  unshakenThresholdPercent: 60,

  requirements: {
    species: {
      species: "divinity",
      count: 5,
    },
  },

  description() {
    return {
      en: `Your divinity champions deal ${this.bonusDmgPercent}% bonus damage to enemies with a lower HP percentage than their own, and take ${this.damageReductionPercent}% less damage (except Absolute Damage) while at or above ${this.unshakenThresholdPercent}% HP.`,
      pt: `Seus campeões divinos causam ${this.bonusDmgPercent}% de dano adicional a inimigos com porcentagem de HP menor que a sua e sofrem ${this.damageReductionPercent}% menos dano (exceto Dano Absoluto) enquanto estiverem com ${this.unshakenThresholdPercent}% de HP ou mais.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;

    if (attacker.team !== owner.team) return;

    // Only Divinity champions benefit from the Emblem.
    if (!championHasSpecies(attacker, "divinity")) return;

    // Judgement only falls on those already faltering.
    if (hpPercent(defender) >= hpPercent(attacker)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },

  onBeforeDmgTaking({ defender, damage, owner }) {
    if (!defender || !owner) return;
    if (!(damage > 0)) return;

    if (defender.team !== owner.team) return;

    if (!championHasSpecies(defender, "divinity")) return;

    // The divine form only holds while it is still mostly intact.
    if (hpPercent(defender) < this.unshakenThresholdPercent) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    const newDamage = Number(damage) - reduction;

    return {
      damage: newDamage,
    };
  },
};
