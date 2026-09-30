import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "ashen_feast",
  name: "Ashen Feast",

  bonusDamagePercent: 25,
  healPercent: 8.5,

  description() {
    return {
      en: `Gorvakharr feeds on what he burns. Every hit he lands against a <b>Burning</b> enemy deals <b>${this.bonusDamagePercent}%</b> increased damage and restores <b>${this.healPercent}%</b> of the damage dealt as <b>HP</b> to him.`,
      pt: `Gorvakharr se alimenta do que queima. Todo golpe que acerta contra um inimigo <b>Queimando</b> causa dano <b>${this.bonusDamagePercent}%</b> maior e lhe restaura <b>${this.healPercent}%</b> do dano causado como <b>HP</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ defender, damage }) {
    if (!damage) return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    return { damage: Number(damage) * (1 + this.bonusDamagePercent / 100) };
  },

  onAfterDmgDealing({ owner, defender, actualDmg, context }) {
    if (!(actualDmg > 0)) return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    const restored = new HealEvent({
      target: owner,
      amount: actualDmg * (this.healPercent / 100),
      context,
      source: owner,
    }).execute();

    if (restored <= 0) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} restored ${restored} HP.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} restaurou ${restored} de HP.`,
      },
    };
  },
};
