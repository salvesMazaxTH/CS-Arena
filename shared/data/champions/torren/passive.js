import { formatChampionName } from "../../../ui/formatters.js";


export default {
  key: "inexorable",
  name: "Inexorable",

  description() {
    return `Can only take direct damage from skills. Damage over time and indirect effects do not affect him. Additionally, Torren takes 10% less damage from all sources (except Absolute Damage).`;
  },

  hookScope: {
    onDamageIncoming: "defender",
    onBeforeDmgTaking: "defender",
  },

  onDamageIncoming({ attacker, defender, skill, damage, context, owner }) {
    if (context.damageDepth > 0 && damage > 0) {
      return {
        cancel: true,
        immune: true,
        message: `<b>[Passive - ${this.name}]</b> ${formatChampionName(defender)} is immune to indirect damage!`,
      };
    }
  },

  onBeforeDmgTaking({ attacker, defender, skill, damage, context, owner }) {
    return {
      damage: damage * 0.9,
    };
  },
};
