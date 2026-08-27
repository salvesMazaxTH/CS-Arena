import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "echoes_of_vitality",
  name: "Echoes of Vitality",
  lifeStealHealPercent: 35,
  description() {
    return `Every drop of life an ally steals rings back through Reyskarone. Whenever an ally restores HP through LifeSteal, he restores ${this.lifeStealHealPercent}% of that amount.`;
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
      log: `↳ [PASSIVE — ${this.name}] ${formatChampionName(owner)} drinks in the vital echo of ${formatChampionName(healSrc)} (+${restored} HP).`,
    };
  },

  /* ------------------
  // TESTING ONLY //
  * -------------------*/
  onAfterDmgTaking({ owner }) {
    owner.portrait = "/assets/portraits/reyskarone_bombado.webp";
  },
};
