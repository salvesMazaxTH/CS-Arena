// shared/data/emblems/mage_arcana.js

import { championHasClass } from "../championClasses.js";

export const mageArcana = {
  key: "mage_arcana",
  name: "Emblem of High Arcana",

  requirements: {
    classKey: {
      key: "mage",
      count: 5,
    },
  },

  bonusDamage: 20,

  description() {
    return `Skill attacks used by your Mage class champions deal ${this.bonusDamage} bonus damage.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
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
