import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { MAX_AMMO, getAmmo, fireBullets } from "./ammo.js";

const zyrelleSkills = [
  // ========================
  // Revolver Shot (global)
  // ========================
  {
    key: "revolver_shot",
    name: "Revolver Shot",

    bf: 60,

    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Zyrelle puts a single round through the chosen target, dealing physical damage. Spends 1 round.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const fired = fireBullets(user, 1, context);

      if (fired === 0) {
        return {
          log: `${formatChampionName(user)}'s hammer clicks on an empty chamber — no rounds left for Revolver Shot!`,
        };
      }

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // Special Skills
  // ========================

  {
    key: "double_action",
    name: "Double Action",

    bfPerHit: 45,
    executeThreshold: 30,

    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Zyrelle fires twice into the chosen target without releasing the trigger, each shot dealing physical damage. The second shot is a guaranteed critical hit if the first one crit, or if the target is already below ${this.executeThreshold}% HP. Spends up to 2 rounds.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];
      const fired = fireBullets(user, 2, context);

      if (fired === 0) {
        return {
          log: `${formatChampionName(user)}'s cylinder is empty — Double Action fires nothing!`,
        };
      }

      const baseDamage = (user.Attack * this.bfPerHit) / 100;

      const firstResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const firstArray = Array.isArray(firstResult)
        ? firstResult
        : [firstResult];
      results.push(...firstArray);

      if (fired < 2) return results;

      const firstCrit = firstArray[0]?.crit?.didCrit;
      const targetIsLow = enemy.HP <= enemy.maxHP * (this.executeThreshold / 100);

      const secondResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: firstCrit || targetIsLow ? { force: true } : undefined,
        allChampions: context?.allChampions,
      }).execute();

      results.push(...(Array.isArray(secondResult) ? secondResult : [secondResult]));

      return results;
    },
  },

  {
    key: "reckless_reload",
    name: "Reckless Reload",

    defensePenaltyPercent: 50,
    vulnerabilityPercent: 10,
    duration: 2,

    contact: false,
    priority: 0,

    description() {
      return `Zyrelle snaps the cylinder open and slams in a full ${MAX_AMMO} rounds, no matter how many she had left. The reload leaves her exposed for ${this.duration} turn(s): -${this.defensePenaltyPercent}% Defense and +${this.vulnerabilityPercent}% damage taken.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime.zyrelleAmmo = MAX_AMMO;
      // Reloading is a deliberate action, not idle — don't also trigger the
      // passive's idle-reload bonus for this same turn.
      user.runtime.zyrelleLastFiredTurn = context.currentTurn;

      user.modifyStat({
        statName: "Defense",
        amount: -this.defensePenaltyPercent,
        isPercent: true,
        duration: this.duration,
        context,
        statModifierSrc: user,
      });

      user.applyDamageReduction({
        amount: -this.vulnerabilityPercent,
        duration: this.duration,
        type: "percent",
        source: this.key,
        context,
      });

      return {
        log: `${formatChampionName(user)} slams in a full reload (${MAX_AMMO}/${MAX_AMMO}), but leaves herself exposed!`,
      };
    },
  },

  {
    key: "empty_the_cylinder",
    name: "Empty the Cylinder",

    bfPerBullet: 42,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Zyrelle unloads every round still in the cylinder into the chosen target, one shot per remaining round, each rolling for its own critical hit. An empty cylinder means an empty ultimate.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];
      const shots = fireBullets(user, getAmmo(user), context);
      const baseDamage = (user.Attack * this.bfPerBullet) / 100;

      for (let i = 0; i < shots; i++) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },
];

export default zyrelleSkills;
