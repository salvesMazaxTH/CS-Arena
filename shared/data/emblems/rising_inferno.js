import { hasElement } from "../../engine/combat/elements.js";

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
    return {
      en: `Fire that finds fire does not start over — it climbs what is already lit. Your Fire damage against a Burning enemy deals bonus damage equal to ${this.maxHPBonusPercent}% of that enemy's maximum HP.`,
      pt: `O fogo que encontra fogo não recomeça — ele sobe pelo que já está aceso. Seu dano de Fogo contra um inimigo Queimando causa dano adicional igual a ${this.maxHPBonusPercent}% do HP máximo dele.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (!hasElement(element, "fire")) return;
    if (!defender.hasStatusEffect("burning")) return;

    const bonus = Math.floor(defender.maxHP * (this.maxHPBonusPercent / 100));
    if (bonus <= 0) return;

    return {
      bonusDamage: bonus,
      log: `<b>[Emblem — Rising Inferno]</b> the flames already on ${defender.name} feed the strike for ${bonus} bonus damage.`,
    };
  },
};
