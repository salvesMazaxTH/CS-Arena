import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "returning_sea",
  name: "Returning Sea",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return {
      en: `The sea always comes back for Naelthos. Whenever he is struck, the tide returns to him and he restores <b>${this.healPerStack}</b> <b>HP</b> for every <b>${this.hpPerStack}</b> <b>HP</b> lost in that hit, up to <b>${this.maxHeal}</b> <b>HP</b> per hit.`,
      pt: `O mar sempre retorna para Naelthos. Sempre que é golpeado, a maré volta até ele e restaura <b>${this.healPerStack}</b> de <b>HP</b> para cada <b>${this.hpPerStack}</b> de <b>HP</b> perdido naquele golpe, até um máximo de <b>${this.maxHeal}</b> de <b>HP</b> por golpe.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ owner, damage, context }) {
    if (damage <= 0) return;

    let heal = Math.floor(damage / this.hpPerStack) * this.healPerStack;

    heal = Math.min(heal, this.maxHeal);

    if (heal <= 0) return;

    new HealEvent({ target: owner, amount: heal, context }).execute();

    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVE — Returning Sea] ${ownerName} restored ${heal} HP.`,
    };
  },
};
