// shared/data/emblems/first_light.js

import { hasElement } from "../../engine/combat/elements.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const firstLight = {
  key: "first_light",
  name: "Emblem of the First Light",

  bonusDmg: 20,

  requirements: {
    elementalAffinity: {
      element: "light",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Light attacks deal <b>${this.bonusDmg}</b> bonus damage.`,
      pt: `Seus ataques de Luz causam <b>${this.bonusDmg}</b> de dano bônus.`,
    };
  },

  onBeforeDmgDealing({ attacker, element, owner }) {
    if (!attacker || !owner) return;
    if (!isEmblemBeneficiary(attacker, owner)) return;
    if (!hasElement(element, "light")) return;

    return { bonusDamage: this.bonusDmg };
  },
};
