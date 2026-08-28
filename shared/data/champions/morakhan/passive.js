import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "first_sutra_adamantine_heart",
  name: "First Sutra: Adamantine Heart",

  flatReductionVSContact: 25, // Kept for reference, but no longer used as a trigger
  stabilityStacksCap: 4,
  dmgBuffAuraDuration: 2,

  description(champion) {
    const stacks = champion.runtime?.stabilityStacks || 0;

    return `Morakhan takes 10% less damage (except Absolute Damage) and reduces damage taken from physical attacks by an additional ${this.flatReductionVSContact}.

    Whenever he takes Physical Damage, he gains 1 <b>Stability</b> stack (Max: ${this.stabilityStacksCap}).

    When he takes a significant hit, he consumes all Stability stacks to reduce the damage taken by an additional 10% per stack and doubles his damage dealt for the next ${this.dmgBuffAuraDuration} turn(s).

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
      finalDamage = Math.max(
        5,
        finalDamage - this.flatReductionVSContact,
      );
    }

    finalDamage *= 0.9;

    // Evaluate whether this is a significant hit.
    const hp = owner.HP;
    const nextHp = hp - damage;
    const halfHp = owner.maxHP * 0.5;

    const isSignificantHit =
      (hp > halfHp && nextHp < halfHp) ||
      (hp <= halfHp && nextHp <= 0);

    if (!stacks || !isSignificantHit) {
      return { damage: finalDamage };
    }

    finalDamage *= 1 - 0.1 * stacks;
    owner.runtime.stabilityStacks = 0;

    owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
      (effect) =>
        effect.key !== "morakhan_adamantine_stability_burst",
    );

    owner.addHookEffect({
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
    }, context);

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

  onAfterDmgTaking({ damage, skill, owner, type }) {
    // type: "physical" | "magical" | ...
    if (damage <= 0 || type !== "physical") return;

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