import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "returning_sea",
  name: "Returning Sea",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return `The sea always comes back for Naelthos. Whenever he takes damage (damage over time excluded), the tide returns to him and he restores ${this.healPerStack} HP for every ${this.hpPerStack} HP lost in that hit, up to ${this.maxHeal} HP per hit.`;
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

    owner.heal(heal, context);

    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVE — Returning Sea] ${ownerName} restored ${heal} HP.`,
    };
  },
};
