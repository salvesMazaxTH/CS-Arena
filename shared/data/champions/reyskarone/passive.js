import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "echoes_of_vitality",
  name: "Echoes of Vitality",
  lifeStealHealPercent: 35,
  description() {
    return {
      en: `Every drop of life an ally steals rings back through Reyskarone. Whenever an ally restores HP through <b>LifeSteal</b>, he restores <b>${this.lifeStealHealPercent}%</b> of that amount.`,
      pt: `Cada gota de vida que um aliado rouba ecoa de volta em Reyskarone. Sempre que um aliado restaura HP por meio de <b>Roubo de Vida</b>, ele restaura <b>${this.lifeStealHealPercent}%</b> dessa quantia.`,
    };
  },

  hookScope: {
    onAfterHealing: undefined,
    onAfterDmgTaking: "defender",
  },

  onAfterHealing({ healSrc, amount, owner, context, isLifesteal }) {
    if (!isLifesteal) return;

    // Basic validations.
    if (!healSrc || !owner) return;
    // Never triggers on enemies.
    if (healSrc.team !== owner.team) return;
    // Ignore self-healing.
    if (healSrc.id === owner.id) return;

    const heal = Math.floor(amount * (this.lifeStealHealPercent / 100));
    if (heal <= 0) return;

    const restored = new HealEvent({
      target: owner,
      amount: heal,
      context,
    }).execute();

    if (restored <= 0) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} drinks in the vital echo of ${formatChampionName(healSrc)} (+${restored} HP).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} absorve o eco vital de ${formatChampionName(healSrc)} (+${restored} HP).`,
      },
    };
  },

  onAfterDmgTaking({ owner }) {
    owner.portrait = "/assets/portraits/reyskarone_bombado.webp";
  },
};
