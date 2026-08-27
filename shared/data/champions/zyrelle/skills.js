import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { MAX_AMMO, getAmmo, fireBullets } from "./ammo.js";

const zyrelleSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

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
        const failMessage = `${formatChampionName(user)}'s cylinder is empty — Double Action fires nothing!`;

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: user.id,
        });

        return { log: failMessage };
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

      if (fired < 2) {
        const outOfAmmoMessage = `${formatChampionName(user)} is out of rounds — Double Action only gets one shot off!`;

        context.registerDialog?.({
          message: outOfAmmoMessage,
          sourceId: user.id,
          targetId: user.id,
        });

        results.push({ log: outOfAmmoMessage });

        return results;
      }

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

      const vulnerabilityPercent = this.vulnerabilityPercent;

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (hook) => hook.key !== "reckless_reload_exposure",
      );
      user.runtime.hookEffects.push({
        key: "reckless_reload_exposure",
        name: "Reckless Reload",
        expiresAtTurn: context.currentTurn + this.duration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        onBeforeDmgTaking({ defender, damage }) {
          if (defender !== user) return;
          return { damage: damage * (1 + vulnerabilityPercent / 100) };
        },
      });

      return {
        log: `${formatChampionName(user)} slams in a full reload (${MAX_AMMO}/${MAX_AMMO}), but leaves herself exposed!`,
      };
    },
  },

  // ========================
  // Ultimate
  // ========================
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
      return `Zyrelle unloads every round still in the cylinder into the chosen target, one shot per remaining round, each rolling for its own critical hit. She reads each hit before firing the next — the moment the target falls, she stops, keeping any rounds still left.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];
      const baseDamage = (user.Attack * this.bfPerBullet) / 100;

      if (getAmmo(user) === 0) {
        const failMessage = `${formatChampionName(user)}'s cylinder is already empty — Empty the Cylinder fires nothing!`;

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: user.id,
        });

        return { log: failMessage };
      }

      while (fireBullets(user, 1, context) > 0) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const array = Array.isArray(result) ? result : [result];
        results.push(...array);

        if (array.some((r) => r?.killed)) break;
      }

      return results;
    },
  },
];

export default zyrelleSkills;
