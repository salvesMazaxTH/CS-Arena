import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "mar_que_retorna",
  name: "Returning Sea",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return `Whenever Naelthos takes damage (except DoT),
    he restores ${this.healPerStack} HP for every ${this.hpPerStack} HP lost in that hit.
    (Max. +${this.maxHeal} per hit)`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    /* console.log(
      "PASSIVA NAELTHOS DISPARADA",
      "owner:",
      owner?.name,
      "receiver:",
      defender?.name,
    );
    */
    let heal = Math.floor(damage / this.hpPerStack) * this.healPerStack;

    heal = Math.min(heal, this.maxHeal);

    if (heal <= 0) return;

    const before = owner.HP;
    owner.heal(heal, context);

    /* console.log(
      `[PASSIVA NAELTHOS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${owner.HP}`,
    );
    */
    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVE — Returning Sea] ${ownerName} restored ${heal} HP.`,
    };
  },
};
