// shared/data/emblems/divine_mandate.js

import { championHasSpecies } from "../championTraits.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

function hpPercent(champion) {
  return (champion.HP / champion.maxHP) * 100;
}

export const divineMandate = {
  key: "divine_mandate",
  name: "Emblem of the Divine Mandate",
  damageBonusPercent: 12,
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
      en: `Your divinity champions deal <b>${this.damageBonusPercent}%</b> increased damage to enemies with a lower <b>HP</b> percentage than their own, and take <b>${this.damageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>) while at or above <b>${this.unshakenThresholdPercent}%</b> <b>HP</b>.`,
      pt: `Seus campeões divinos causam dano <b>${this.damageBonusPercent}%</b> maior a inimigos com porcentagem de <b>HP</b> menor que a sua e sofrem <b>${this.damageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>) enquanto estiverem com <b>${this.unshakenThresholdPercent}%</b> de <b>HP</b> ou mais.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;

    if (!isEmblemBeneficiary(attacker, owner)) return;

    // Only Divinity champions benefit from the Emblem.
    if (!championHasSpecies(attacker, "divinity")) return;

    // Judgement only falls on those already faltering.
    if (hpPercent(defender) >= hpPercent(attacker)) return;

    const bonusDamage = Number(damage) * (this.damageBonusPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },

  onBeforeDmgTaking({ defender, damage, owner }) {
    if (!defender || !owner) return;
    if (!(damage > 0)) return;

    if (!isEmblemBeneficiary(defender, owner)) return;

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
