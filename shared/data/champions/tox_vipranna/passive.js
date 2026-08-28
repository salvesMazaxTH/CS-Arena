import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "toxic_metabolism",
  name: "Toxic Metabolism",

  healPercent: 35,

  description() {
    return `Tox Vipranna absorbs the venom released by Poisoned targets, restoring ${this.healPercent}% of the damage dealt by Poisoned to her HP.`;
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  // No hookScope — triggers for Tox Vipranna whenever onAfterDmgTaking is emitted,
  // regardless of who took the damage (intended to react to any Poisoned tick).
  onAfterDmgTaking({ owner, damage, context, skill }) {
    if (!context?.isDot) return;
    if (skill?.key !== "poisoned_tick") return;
    if (!damage || damage <= 0) return;

    const healAmount = Math.floor(damage * (this.healPercent / 100));

    if (healAmount <= 0) return;

    const before = owner.HP;
    const healed = new HealEvent({
      target: owner,
      amount: healAmount,
      context,
    }).execute();

    if (healed <= 0) return;

    const ownerName = formatChampionName(owner);

    return {
      log: `[PASSIVE — ${this.name}] ${ownerName} absorbs the venom and restores ${healed} HP (${before} → ${owner.HP}).`,
    };
  },
};