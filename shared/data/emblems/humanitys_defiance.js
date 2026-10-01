// shared/data/emblems/humanitys_defiance.js

import { championHasSpecies } from "../championTraits.js";

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

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender) return;

    if (attacker.team !== owner.team) return;

    // Only Human champions benefit from the Emblem.
    if (!championHasSpecies(attacker, "human")) return;

    // Only apply bonus if defender is non-human
    if (championHasSpecies(defender, "human")) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },

  onBeforeDmgTaking({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;
    if (!(damage > 0)) return;

    if (defender.team !== owner.team) return;

    if (!championHasSpecies(defender, "human")) return;

    // Only apply reduction if attacker has higher Attack stat
    if (attacker.Attack <= defender.Attack) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    const newDamage = Number(damage) - reduction;

    return {
      damage: newDamage,
    };
  },
};
