// shared/data/emblems/mage_arcana.js

import { championHasClass } from "../championClasses.js";

export const mageArcana = {
  key: "mage_arcana",
  name: "Emblem of High Arcana",

  requirements: {
    classKey: [{ key: "mage", count: 5 }],
  },

  bonusDamage: 20,

  description() {
    return {
      en: `Skill attacks used by your Mage class champions deal <b>${this.bonusDamage}</b> bonus damage.`,
      pt: `Ataques de habilidade usados pelos seus campeões da classe Mago causam <b>${this.bonusDamage}</b> de dano bônus.`,
    };
  },

  onBeforeDmgDealing({ attacker, skill, owner }) {
    if (!attacker || !skill) return;
    if (attacker.team !== owner?.team) return;
    if (!championHasClass(attacker, "mage")) return;

    return {
      bonusDamage: this.bonusDamage,
    };
  },
};
