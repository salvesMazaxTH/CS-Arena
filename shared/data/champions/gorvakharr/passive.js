import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "ashen_feast",
  name: "Ashen Feast",

  bonusDamagePercent: 25,
  healPercent: 8.5,

  description() {
    return `Gorvakharr feeds on what he burns. Every hit he lands against a Burning enemy deals ${this.bonusDamagePercent}% bonus damage and heals him for ${this.healPercent}% of the damage dealt.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || !damage) return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    return { damage: Number(damage) * (1 + this.bonusDamagePercent / 100) };
  },

  onAfterDmgDealing({ attacker, owner, defender, actualDmg, context }) {
    if (attacker !== owner || !(actualDmg > 0)) return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    const restored = new HealEvent({
      target: owner,
      amount: actualDmg * (this.healPercent / 100),
      context,
      source: owner,
    }).execute();

    if (restored <= 0) return;

    return {
      log: `[PASSIVE — Ashen Feast] ${formatChampionName(owner)} restored ${restored} HP.`,
    };
  },
};
