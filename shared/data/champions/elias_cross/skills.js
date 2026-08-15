import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

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
      const baseDamage = (user.Attack * this.bf) / 100;

      const isOverloaded = enemy.hasStatusEffect("conductor");

      /* console.log(
        `Lightning Impact: ${formatChampionName(enemy)} ${
          isOverloaded ? "has" : "does not have"
        } Conductor. Target Status Effects: ${[
          ...enemy.statusEffects.keys(),
        ].join(", ")}`,
      );
      */

      const results = [];

      const pushResult = (r) => {
        if (Array.isArray(r)) results.push(...r);
        else if (r) results.push(r);
      };

      const result = new DamageEvent({
        baseDamage: isOverloaded
          ? baseDamage + this.damageBonus
          : baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      pushResult(result);

      return results;
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

    description() {
      return `Elias Cross gains +35% Passive chance this turn and the next. If the target has Conductor, deals ${this.damageBonus} bonus Absolute Damage.`;
    },

    targetSpec: ["enemy", "self"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      // Applies the temporary bonus and stores the actual amount applied
      // so it can be correctly removed when it expires.
      const initialChance = user.passive?.initialChance ?? 1;
      const currentChance =
        user.runtime.passiveChance ?? initialChance;

      const nextChance = Math.min(100, currentChance + 35);
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

      const baseDamage = (user.Attack * this.bf) / 100;
      const isOverloaded =
        enemy.hasStatusEffect("conductor");

      const result = new DamageEvent({
        baseDamage: isOverloaded
          ? baseDamage + this.damageBonus
          : baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

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
    reductedDamagePercent: 20,
    recoilDamageMode: "absolute",

    cannotBeEvaded: true,

    contact: false,
    priority: 0,

    element: "lightning",

    description() {
      return `Deals damage to ALL characters except Elias Cross. Characters with Lightning or Earth Affinity take only ${this.reductedDamagePercent}% damage. However, Elias Cross takes Absolute Recoil Damage equal to ${this.recoilDamage}% of his Max HP. Targets below 17% HP are obliterated, or below 25% HP if they have Conductor. This attack cannot be evaded.`;
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

      // Find a single valid iteration to attach the recoil to.
      const recoilIndex = targetList.findIndex(
        (t) => t?.alive && t !== user,
      );

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

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
            (this.reductedDamagePercent / 100);
        }

        // 🔥 Inject recoil into a single valid execution.
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