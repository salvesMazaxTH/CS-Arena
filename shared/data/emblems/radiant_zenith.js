// shared/data/emblems/radiant_zenith.js

import { hasElement } from "../../engine/combat/elements.js";
import { formatChampionName } from "../../ui/formatters.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const radiantZenith = {
  key: "radiant_zenith",
  name: "Emblem of the Radiant Zenith",
  maxHPBonusPercent: 10,

  requirements: {
    elementalAffinity: {
      element: "light",
      count: 5,
    },
  },

  description() {
    return {
      en: `Light at its zenith leaves no shadow to hide in. Your Light damage deals bonus damage equal to <b>${this.maxHPBonusPercent}%</b> of the target's <b>Max HP</b>.`,
      pt: `A luz em seu zênite não deixa sombra onde se esconder. Seu dano de Luz causa dano bônus igual a <b>${this.maxHPBonusPercent}%</b> do <b>HP Máximo</b> do alvo.`,
    };
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (!isEmblemBeneficiary(attacker, owner)) return;
    if (!hasElement(element, "light")) return;

    const bonus = Math.floor(defender.maxHP * (this.maxHPBonusPercent / 100));
    if (bonus <= 0) return;

    return {
      bonusDamage: bonus,
      log: {
        en: `<b>[Emblem — Radiant Zenith]</b> the light at its peak burns ${formatChampionName(defender)} for <b>${bonus}</b> bonus damage.`,
        pt: `<b>[Emblema — Radiant Zenith]</b> a luz em seu auge queima ${formatChampionName(defender)} com <b>${bonus}</b> de dano bônus.`,
      },
    };
  },
};
