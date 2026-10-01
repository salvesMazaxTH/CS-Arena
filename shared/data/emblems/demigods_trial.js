// shared/data/emblems/demigods_trial.js

import { championHasSpecies } from "../championTraits.js";

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
    return {
      en: `Your demigod champions deal ${this.bonusDmgPercent}% bonus damage to enemies with more current HP than their own, and take ${this.damageReductionPercent}% less damage (except Absolute Damage) from enemies with a higher Max HP than their own.`,
      pt: `Seus campeões semideuses causam ${this.bonusDmgPercent}% de dano adicional a inimigos com mais HP atual que o seu e sofrem ${this.damageReductionPercent}% menos dano (exceto Dano Absoluto) de inimigos com HP Máximo maior que o seu.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (!championHasSpecies(attacker, "demigod")) return;

    // The trial is always a fight against something greater.
    if (Number(defender.HP) <= Number(attacker.HP)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    return { damage: Number(damage) + bonusDamage };
  },

  onBeforeDmgTaking({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;
    if (defender.team !== owner.team) return;
    if (!championHasSpecies(defender, "demigod")) return;
    if (!(damage > 0)) return;

    if (Number(attacker.maxHP) <= Number(defender.maxHP)) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    return { damage: Number(damage) - reduction };
  },
};
