import { formatChampionName } from "../../../ui/formatters.js";

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

    Whenever he takes Physical Damage, he gains 1 <b>Stability</b> stack (Max: ${this.stabilityStacksCap}).

    When a hit would deal more than ${this.significantHitRatio * 100}% of his Max HP, he consumes all Stability stacks to reduce that damage by an additional 10% per stack and doubles his damage dealt for the next ${this.dmgBuffAuraDuration} turn(s).

    <b>Current Stacks: ${stacks}</b>`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ damage, skill, context, owner, defender, type }) {
    // type: "physical" | "magical" | ...
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
    owner.runtime.stabilityStacks = 0;

    owner.runtime.hookEffects ??= [];
    owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
      (effect) => effect.key !== "morakhan_adamantine_stability_burst",
    );

    owner.addHookEffect(
      {
        type: "buff",
        key: "morakhan_adamantine_stability_burst",
        name: "Empowered Adamantine Stability",
        expiresAtTurn: context.currentTurn + 2,

        hookScope: {
          onBeforeDmgDealing: "attacker",
        },

        hookPolicies: {
          onBeforeDmgDealing: {
            allowOnDot: true,
            allowOnNestedDamage: true,
          },
        },

        onBeforeDmgDealing({ damage, attacker, skill }) {
          return {
            damage: damage * 2,
            log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
              attacker,
            )} doubles the damage dealt${
              skill?.key === "fourth_sutra_mountain_stance_counter"
                ? " by the counterattack"
                : ""
            }!`,
          };
        },
      },
      context,
    );

    const msg = `<b>[Passive — ${this.name}]</b> ${formatChampionName(
      owner,
    )} consumed ${stacks} Stability stack(s)!`;

    context.registerDialog?.({
      message: msg,
      sourceId: owner.id,
      targetId: defender.id,
    });

    return {
      damage: finalDamage,
      log: msg,
    };
  },

  onAfterDmgTaking({ actualDmg, owner, type }) {
    if (!(actualDmg > 0) || type !== "physical") return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) return;

    runtime.stabilityStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} gains 1 Stability stack (${runtime.stabilityStacks}/${this.stabilityStacksCap}).`,
    };
  },
};
