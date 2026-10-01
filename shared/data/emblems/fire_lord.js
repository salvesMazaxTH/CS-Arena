import { hasElement } from "../../engine/combat/elements.js";

// shared/data/emblems/fire_lord.js

export const firelord = {
  key: "fire_lord",
  name: "Emblem of the Fire Lord",
  bonusDmg: 20,

  requirements: {
    elementalAffinity: {
      element: "fire",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Fire attacks deal <b>${this.bonusDmg}</b> bonus damage.`,
      pt: `Seus ataques de Fogo causam <b>${this.bonusDmg}</b> de dano bônus.`,
    };
  },

  onBeforeDmgDealing({ attacker, element, owner }) {
    if (!attacker || !owner) return;

    if (attacker.team !== owner.team) return;

    if (!hasElement(element, "fire")) return;

    return {
      bonusDamage: this.bonusDmg,
    };
  },
};
