// shared/data/emblems/humanitys_defiance.js

import { championHasSpecies } from "../championTraits.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const humanitysDefiance = {
  key: "humanitys_defiance",
  name: "Emblem of Humanity's Defiance",
  damageBonusPercent: 10,
  damageReductionPercent: 15,

  requirements: {
    species: {
      species: "human",
      count: 7,
    },
  },

  description() {
    return {
      en: `Your human champions deal <b>${this.damageBonusPercent}%</b> increased damage to non-human enemies and take <b>${this.damageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>) from enemies with higher <b>Attack</b> than them.`,
      pt: `Seus campeões humanos causam dano <b>${this.damageBonusPercent}%</b> maior a inimigos não humanos e sofrem <b>${this.damageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>) de inimigos com <b>Ataque</b> maior que o seu.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender) return;

    if (!isEmblemBeneficiary(attacker, owner)) return;

    // Only Human champions benefit from the Emblem.
    if (!championHasSpecies(attacker, "human")) return;

    // Only apply bonus if defender is non-human
    if (championHasSpecies(defender, "human")) return;

    const bonusDamage = Number(damage) * (this.damageBonusPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },

  onBeforeDmgTaking({ defender, attacker, damage, owner }) {
    if (!defender || !attacker || !owner) return;
    if (!(damage > 0)) return;

    if (!isEmblemBeneficiary(defender, owner)) return;

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
