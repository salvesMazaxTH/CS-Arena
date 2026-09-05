import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

const STABILITY_BURST_KEY = "morakhan_adamantine_stability_burst";

export default {
  key: "first_sutra_adamantine_heart",
  name: "First Sutra: Adamantine Heart",

  flatReductionVSPhysical: 25,
  stabilityStacksCap: 4,
  dmgBuffAuraDuration: 2,
  significantHitRatio: 0.35,

  description(champion) {
    const stacks = champion.runtime?.stabilityStacks || 0;

    return `Morakhan takes 10% less damage (except Absolute Damage) and reduces damage taken from physical attacks by an additional ${this.flatReductionVSPhysical}.

    Whenever he takes Physical Damage, he gains 1 <b>Stability</b> stack (Max: ${this.stabilityStacksCap}). A CLAIM, taken in stillness, grants 1 stack as well.

    When a hit would deal more than ${this.significantHitRatio * 100}% of his Max HP, he consumes all Stability stacks to reduce that damage by an additional 10% per stack, then doubles his damage dealt for the next ${this.dmgBuffAuraDuration} turns.

    While already at maximum Stability, the next stack he would gain — whether from a Physical hit or a CLAIM — is spent immediately instead: no damage is reduced, but the doubling still triggers.

    <b>Current Stacks: ${stacks}</b>`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  // Empties Stability and arms the damage-doubling aura. Returns the summary line.
  consumeStability(owner, context, consumedStacks) {
    owner.runtime.stabilityStacks = 0;

    owner.runtime.hookEffects ??= [];
    owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
      (effect) => effect.key !== STABILITY_BURST_KEY,
    );

    owner.addHookEffect(
      {
        type: "buff",
        key: STABILITY_BURST_KEY,
        name: "Empowered Adamantine Stability",
        // +1 so the aura covers dmgBuffAuraDuration full playable turns.
        expiresAtTurn: context.currentTurn + this.dmgBuffAuraDuration + 1,

        hookScope: {
          onBeforeDmgDealing: "attacker",
        },

        hookPolicies: {
          onBeforeDmgDealing: {
            allowOnDot: true,
            allowOnNestedDamage: true,
          },
        },

        onBeforeDmgDealing({ damage, attacker, skill, hitId }) {
          const isOwnCounter =
            skill?.key === "fourth_sutra_mountain_stance" &&
            hitId === "reflection";

          return {
            damage: damage * 2,
            log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
              attacker,
            )} doubles the damage dealt${
              isOwnCounter ? " by the counterattack" : ""
            }!`,
          };
        },
      },
      context,
    );

    const msg = `<b>[Passive — ${this.name}]</b> ${formatChampionName(
      owner,
    )} consumed ${consumedStacks} Stability stack(s)!`;

    context.registerDialog({
      message: msg,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return msg;
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) {
      return { log: this.consumeStability(owner, context, stacks) };
    }

    runtime.stabilityStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} recites a sutra through the CLAIM and gains 1 Stability stack (${runtime.stabilityStacks}/${this.stabilityStacksCap}).`,
    };
  },

  onBeforeDmgTaking({ damage, context, owner, type }) {
    const isPhysical = type === "physical";
    const stacks = owner.runtime?.stabilityStacks || 0;

    let finalDamage = damage;

    if (isPhysical) {
      finalDamage = Math.max(5, finalDamage - this.flatReductionVSPhysical);
    }

    finalDamage *= 0.9;

    // Measured against the post-mitigation figure, not the raw incoming hit.
    const isSignificantHit =
      finalDamage > owner.maxHP * this.significantHitRatio;

    if (!stacks || !isSignificantHit) {
      return { damage: finalDamage };
    }

    finalDamage *= 1 - 0.1 * stacks;

    return {
      damage: finalDamage,
      log: this.consumeStability(owner, context, stacks),
    };
  },

  onAfterDmgTaking({ actualDmg, owner, type, context }) {
    if (!(actualDmg > 0) || type !== "physical") return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) {
      return { log: this.consumeStability(owner, context, stacks) };
    }

    runtime.stabilityStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} gains 1 Stability stack (${runtime.stabilityStacks}/${this.stabilityStacksCap}).`,
    };
  },
};
