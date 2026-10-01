import { hasElement } from "../../engine/combat/elements.js";
import { formatChampionName } from "../../ui/formatters.js";

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
      en: `Fire that finds fire does not start over — it climbs what is already lit. Your Fire damage against a Burning enemy deals bonus damage equal to <b>${this.maxHPBonusPercent}%</b> of that enemy's <b>Max HP</b>.`,
      pt: `O fogo que encontra fogo não recomeça — ele sobe pelo que já está aceso. Seu dano de Fogo contra um inimigo <b>Queimando</b> causa dano bônus igual a <b>${this.maxHPBonusPercent}%</b> do <b>HP Máximo</b> dele.`,
    };
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
      log: {
        en: `<b>[Emblem — Rising Inferno]</b> the flames already on ${formatChampionName(defender)} feed the strike for ${bonus} bonus damage.`,
        pt: `<b>[Emblema — Rising Inferno]</b> as chamas que já ardem em ${formatChampionName(defender)} alimentam o golpe com ${bonus} de dano adicional.`,
      },
    };
  },
};
