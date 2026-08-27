import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "heart_of_the_tides",
  name: "Heart of the Tides",

  healPerHit: 10,
  dmgPerStack: 10,
  maxStacks: 4,

  description(champion) {
    const stacks = champion?.runtime?.mareStacks || 0;

    return `Whenever she deals damage, she restores ${this.healPerHit} HP. Each time she restores HP this way, she gains 1 Tides stack.

  Each stack grants +${this.dmgPerStack} flat damage. Max ${this.maxStacks} stacks. Stacks are permanent.

  Current stacks: ${stacks}/${this.maxStacks}
  Maximum total bonus: +${this.dmgPerStack * this.maxStacks} damage.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterHealing: "healSrc",
  },

  onAfterDmgDealing({ attacker, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    // Restore HP
    const restored = new HealEvent({
      target: owner,
      amount: this.healPerHit,
      context,
    }).execute();

    if (restored <= 0) return;

    return {
      log: `[Heart of the Tides] ${formatChampionName(
        owner,
      )} restored ${restored} HP and gained 1 Tides stack (${owner.runtime.mareStacks}/${this.maxStacks}).`,
    };
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (healSrc.id !== owner?.id) return;
    // Only HP she restores to herself feeds the stacks, as her passive states.
    if (healTarget.id !== owner.id) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    if (owner.runtime.mareStacks >= this.maxStacks) return;

    owner.runtime.mareStacks++;

    // Add the modifier ONCE, on the first stack (same as Naelthos does on his Ultimate)
    const alreadyHas = owner
      .getDamageModifiers()
      .some((m) => m.id === "tides-stacks");

    if (!alreadyHas) {
      owner.addDamageModifier({
        id: "tides-stacks",
        name: "Tides",
        permanent: true,
        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.min(
            attacker.runtime?.mareStacks || 0,
            this.maxStacks,
          );
          return baseDamage + stacks * this.dmgPerStack;
        },
      });
    }
  },
};
