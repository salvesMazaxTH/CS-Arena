import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "toxic_metabolism",
  name: "Toxic Metabolism",

  healPercent: 35,
  claimPoisonStacks: 2,

  description() {
    return `Tox Vipranna absorbs the venom released by Poisoned targets, restoring ${this.healPercent}% of the damage dealt by Poisoned to her HP.

    When she uses CLAIM, ${this.claimPoisonStacks} stacks of Poisoned scatter at random across the enemy line — both may land on one foe or one on each.`;
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const enemies = context.aliveChampions.filter((c) => c.team !== owner.team);
    if (!enemies.length) return;

    for (let i = 0; i < this.claimPoisonStacks; i++) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      target.applyStatusEffect("poisoned", undefined, context, {}, 1);
    }

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} lets the CLAIM carry her venom — ${this.claimPoisonStacks} stacks of Poisoned scatter across the enemy line.`,
    };
  },

  // Unscoped on purpose: fires for Tox Vipranna on any champion's onAfterDmgTaking
  // so she reacts to every Poisoned tick, not only her own.
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