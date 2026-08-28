import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const eliasCrossSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "lightning_impact",
    name: "Lightning Impact",
    bf: 70,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    cannotBeEvaded: true,
    element: "lightning",

    description() {
      return `If the target has Conductor, deals ${this.damageBonus} bonus Absolute Damage. This attack cannot be evaded.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      if (enemy.hasStatusEffect("conductor")) {
        context.extraDamageQueue ??= [];

        context.extraDamageQueue.push({
          baseDamage: this.damageBonus,
          mode: this.damageBonusMode,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "latent_charge",
    name: "Latent Charge",
    bf: 25,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    element: "lightning",

    passiveChanceBonus: 35,
    conductorDuration: 2,

    description() {
      return `Elias Cross gains +${this.passiveChanceBonus}% Passive chance this turn and the next. If the target has Conductor, deals ${this.damageBonus} bonus Absolute Damage. Marks the target as a Conductor for ${this.conductorDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      // The amount actually applied is stored so expiry can remove exactly it.
      const currentChance =
        user.runtime.passiveChance ?? user.passive.initialChance;

      const nextChance = Math.min(
        100,
        currentChance + this.passiveChanceBonus,
      );
      const appliedBonus = Math.max(
        0,
        nextChance - currentChance,
      );

      user.runtime.passiveChance = nextChance;

      if (appliedBonus > 0) {
        user.runtime.passiveTempBuffs ??= [];

        user.runtime.passiveTempBuffs.push({
          amount: appliedBonus,
          expiresAtTurn: (context?.currentTurn ?? 0) + 2,
        });
      }

      if (enemy.hasStatusEffect("conductor")) {
        context.extraDamageQueue ??= [];

        context.extraDamageQueue.push({
          baseDamage: this.damageBonus,
          mode: this.damageBonusMode,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
        sourceSkill: this,
      });

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "lightning_storm",
    name: "Lightning Storm",
    bf: 120,

    damageMode: "standard",

    isUltimate: true,
    momentumCost: 66,

    recoilDamage: 25,
    reducedDamagePercent: 20,
    recoilDamageMode: "absolute",

    cannotBeEvaded: true,

    contact: false,
    priority: 0,

    element: "lightning",

    description() {
      return `Deals damage to ALL characters except Elias Cross. Characters with Lightning or Earth Affinity take only ${this.reducedDamagePercent}% damage. However, Elias Cross takes Absolute Recoil Damage equal to ${this.recoilDamage}% of his Max HP. Targets below 17% HP are obliterated, or below 25% HP if they have Conductor. This attack cannot be evaded.`;
    },

    finishingType: "obliterate",

    finishingRule(ctx) {
      const target = ctx.defender;
      const hasOverload =
        target.hasStatusEffect("conductor");

      return hasOverload ? 0.25 : 0.17;
    },

    targetSpec: ["all"],

    resolve({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      // The recoil rides the last struck target, so it can never cut the storm short.
      const recoilIndex = targetList.findLastIndex(
        (t) => t?.alive && t !== user,
      );

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (!user.alive) break;
        if (!target?.alive) continue;
        if (target === user) continue;

        const affinities = target.elementalAffinities || [];

        let finalBaseDamage = baseDamage;

        if (
          affinities.includes("lightning") ||
          affinities.includes("earth")
        ) {
          finalBaseDamage =
            baseDamage *
            (this.reducedDamagePercent / 100);
        }

        if (i === recoilIndex) {
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            baseDamage:
              (user.maxHP * this.recoilDamage) / 100,
            mode: this.recoilDamageMode,
            attacker: user,
            defender: user,
            type: "magical",
            skill: this,
          });
        }

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) {
          results.push(...result);
        } else if (result) {
          results.push(result);
        }
      }

      const eliasUltLog = `${formatChampionName(
        user,
      )} took ${this.recoilDamage}% of his Max HP as Absolute Recoil Damage.`;

      // Inject into a single result (the first valid one).
      if (results.length > 0) {
        results[0].log =
          (results[0].log ?? "") +
          `\n${eliasUltLog}`;
      } else {
        // Optional fallback.
        console.warn(
          "Lightning Storm: no result available to append recoil log",
        );
      }

      return results;
    },
  },
];

export default eliasCrossSkills;