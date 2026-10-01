// shared/data/emblems/demigods_trial.js

import { championHasSpecies } from "../championTraits.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const demigodsTrial = {
  key: "demigods_trial",
  name: "Emblem of the Demigod's Trial",
  damageBonusPercent: 14,
  damageReductionPercent: 16,

  requirements: {
    species: {
      species: "demigod",
      count: 5,
    },
  },

  description() {
    return {
      en: `Your demigod champions deal <b>${this.damageBonusPercent}%</b> increased damage to enemies with more current <b>HP</b> than their own, and take <b>${this.damageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>) from enemies with a higher <b>Max HP</b> than their own.`,
      pt: `Seus campeões semideuses causam dano <b>${this.damageBonusPercent}%</b> maior a inimigos com mais <b>HP</b> atual que o seu e sofrem <b>${this.damageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>) de inimigos com <b>HP Máximo</b> maior que o seu.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;
    if (!isEmblemBeneficiary(attacker, owner)) return;
    if (!championHasSpecies(attacker, "demigod")) return;

    // The trial is always a fight against something greater.
    if (Number(defender.HP) <= Number(attacker.HP)) return;

    const bonusDamage = Number(damage) * (this.damageBonusPercent / 100);
    return { damage: Number(damage) + bonusDamage };
  },

  onBeforeDmgTaking({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;
    if (!isEmblemBeneficiary(defender, owner)) return;
    if (!championHasSpecies(defender, "demigod")) return;
    if (!(damage > 0)) return;

    if (Number(attacker.maxHP) <= Number(defender.maxHP)) return;

    const reduction = Number(damage) * (this.damageReductionPercent / 100);
    return { damage: Number(damage) - reduction };
  },
};
