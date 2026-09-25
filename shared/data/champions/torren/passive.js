import { formatChampionName } from "../../../ui/formatters.js";


export default {
  key: "unyielding",
  name: "Unyielding",

  description() {
    return {
      en: `Torren can only take direct damage from skills — damage over time and other indirect effects do not affect him. He also takes <b>10%</b> less damage from all sources, except <b>Absolute Damage</b>.`,
      pt: `Torren só pode sofrer dano direto de habilidades — dano ao longo do tempo e outros efeitos indiretos não o afetam. Ele também sofre <b>10%</b> a menos de dano de qualquer fonte, exceto <b>Dano Absoluto</b>.`,
    };
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
