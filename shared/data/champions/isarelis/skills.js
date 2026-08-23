import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const isarelisSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "eviscerate",
    name: "Eviscerate",

    bf: 55,
    damageMode: "standard",
    contact: true,
    hitVfx: "multislash",
    priority: 0,

    description() {
      return "Isarelis closes on the chosen target with both daggers reversed and opens them up in a handful of strokes, short blades finding the gaps a longer edge would never reach, dealing physical contact damage.";
    },

    targetSpec: ["enemy"],

    // Configurable
    damageBonusRatio: 0.2,
    piercingRatio: 0.6,

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // The Backstab passive applies the bonus damage and Piercing Damage via hook.
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },

  {
    key: "shadowstep",
    name: "Shadowstep",

    description() {
      return "Becomes Invisible until her next action. Cannot be targeted by enemies.";
    },

    targetSpec: ["self"],
    priority: 1,

    resolve({ user, context }) {
      // Reset previous Invisibility.
      user.removeStatusEffect("invisible");

      user.applyStatusEffect("invisible", 99, context, {
        source: "shadowstep",
      });

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "shadowstep_cleanup",
      );

      const appliedContext = context;

      user.runtime.hookEffects.push({
        key: "shadowstep_cleanup",
        group: "skillRuntime",
        ownerId: user.id,

        hookScope: {
          onActionResolved: "actionSource",
        },

        onActionResolved({ owner, actionSource, context }) {
          if (!actionSource || actionSource.id !== owner.id) return;

          // Ignore the action that applied Invisibility.
          if (context === appliedContext) return;

          // Any subsequent action removes Invisibility.
          owner.removeStatusEffect("invisible");

          owner.runtime.hookEffects =
            owner.runtime.hookEffects.filter(
              (e) => e.key !== "shadowstep_cleanup",
            );

          context?.registerDialog?.({
            message: `${formatChampionName(owner)} emerges from the shadows.`,
            sourceId: owner.id,
          });
        },
      });

      context.registerDialog({
        message: `${formatChampionName(user)} disappears into the shadows.`,
        sourceId: user.id,
      });

      return [
        {
          log: `${formatChampionName(
            user,
          )} disappears into the shadows and becomes <b>Invisible</b> until her next action.`,
        },
      ];
    },
  },

  {
    key: "coup_de_grace",
    name: "Coup de Grâce",

    bf: 85,
    damageMode: "standard",
    hitVfx: "multislash",
    contact: true,
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    executeThreshold: 0.25,
    executeFlatThreshold: 85,
    stealthBonus: 0.5,
    finishingType: "regular",

    description() {
      const percent = this.executeThreshold * 100;

      return `Deals heavy damage to the chosen target. Executes the target only if they are critically wounded (≤ ${percent}% of their Max HP and ≤ ${this.executeFlatThreshold} HP). Deals ${this.stealthBonus * 100}% bonus damage while Invisible.`;
    },

    finishingRule({ defender }) {
      const maxHP = defender?.maxHP;
      const currentHP = defender?.HP;

      if (!Number.isFinite(maxHP) || maxHP <= 0) {
        return this.executeThreshold;
      }

      if (!Number.isFinite(currentHP)) return;

      // Flat condition first.
      if (currentHP > this.executeFlatThreshold) return;

      return this.executeThreshold;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      if (!enemy) return;

      let baseDamage = (user.Attack * this.bf) / 100;

      if (user.hasStatusEffect("invisible")) {
        baseDamage *= 1 + this.stealthBonus;

        context.registerDialog({
          message: `${formatChampionName(user)} strikes from the shadows!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },
];

export default isarelisSkills;