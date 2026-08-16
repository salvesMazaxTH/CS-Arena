import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const jeffTheDeathSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "funeral_strike",
    name: "Funeral Strike",

    bf: 55,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 70, // 70% Piercing Damage
    priority: 0,

    description() {
      return `Jeff deals Piercing Damage (${this.piercingPercentage}% Piercing) to the chosen enemy target. If Jeff has already died, this ability also deals damage to adjacent champions.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime.deathCounter ??= 0;

      const results = [];

      // PRIMARY
      const primaryResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];

      results.push(...primaryResults);

      // No death stacks, so the effect ends here.
      if (user.runtime.deathCounter <= 0) return results;

      const adjacentEnemies =
        context.getAdjacentChampions(enemy) || [];

      // Deal damage to each adjacent enemy.
      for (const adjacentEnemy of adjacentEnemies) {
        const result = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPercentage: this.piercingPercentage,
          attacker: user,
          defender: adjacentEnemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const adjacentResults = Array.isArray(result)
          ? result
          : [result];

        results.push(...adjacentResults);
      }

      return results;
    },
  },

  {
    key: "deaths_embrace",
    name: "Death's Embrace",

    bf: 40,
    damageMode: "standard",

    markDuration: 2,
    rewardAttack: 20,
    punishPercent: 0.2,

    contact: false,
    priority: 1,

    description() {
      return `Deals damage to the chosen target and marks them for ${this.markDuration} turn(s).
      
      If the target dies while marked, Jeff gains +${this.rewardAttack} permanent Attack.
      
      Otherwise, the target takes bonus damage equal to ${this.punishPercent * 100}% of their current HP at the start of each turn.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Mark the enemy.
      enemy.runtime.markedByDeathsEmbrace = true;

      const punishDamage = enemy.HP * this.punishPercent;
      const rewardAttack = this.rewardAttack;

      enemy.runtime.hookEffects ??= [];

      enemy.runtime.hookEffects.push({
        key: "deaths_embrace_mark",
        expiresAtTurn:
          context.currentTurn + this.markDuration,

        onTurnStart({ owner, context }) {
          if (!owner.runtime.markedByDeathsEmbrace) return;

          if (this.expiresAtTurn < context.currentTurn) {
            owner.runtime.markedByDeathsEmbrace = false;
            return;
          }

          context.isDot = true;

          const result = new DamageEvent({
            baseDamage: punishDamage,
            mode: DamageEvent.Modes.ABSOLUTE,
            attacker: null,
            defender: owner,
            skill: {
              key: "deaths_embrace_punish",
              contact: false,
              damageMode: "absolute",
            },
            type: "magical",
            context,
            allChampions: context?.allChampions,
          }).execute();

          if (result?.immune) {
            return {
              log: `${formatChampionName(
                owner,
              )} is immune to Death's Embrace damage!`,
            };
          }

          return {
            log: `${formatChampionName(
              owner,
            )} takes ${
              result?.totalDamage ?? punishDamage
            } <b>Death's Embrace</b> damage.`,
          };
        },
      });

      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects.push({
        key: "deaths_embrace_buff",
        expiresAtTurn:
          context.currentTurn + this.markDuration,

        onChampionDeath({ deadChampion, context }) {
          if (deadChampion !== enemy) return;

          // Reward: Jeff gains permanent Attack.
          user.modifyStat({
            statName: "Attack",
            amount: rewardAttack,
            isPermanent: true,
            context,
          });

          user.runtime.hookEffects =
            user.runtime.hookEffects.filter(
              (effect) => effect.key !== "deaths_embrace_buff",
            );
        },
      });

      return damageResult;
    },
  },

  {
    key: "deaths_inevitability",
    name: "Death's Inevitability",

    bf: 50,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,

    priority: 0,

    threshold: 0.25,

    description() {
      return `Deals moderate damage to the chosen target and marks them for death. At the start of the next turn, if the target is below ${this.threshold * 100}% HP, Death claims them.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const threshold = this.threshold;
      const triggerTurn =
        (context.currentTurn ?? 0) + 1;

      enemy.runtime.markedByDeathsInevitability = true;

      // Internal hook for the inevitable execution.
      const hook = {
        key: "death_claim_execution",
        group: "deathClaim",
        triggerTurn,

        priority: -999,

        onTurnStart({ owner, context }) {
          if (!owner.alive) {
            owner.runtime.markedByDeathsInevitability = false;

            owner.runtime.hookEffects =
              owner.runtime.hookEffects.filter(
                (effect) =>
                  effect.key !== "death_claim_execution",
              );

            return;
          }

          // Check only once, at the start of the following turn.
          if (context.currentTurn !== this.triggerTurn) return;

          if (owner.HP / owner.maxHP <= threshold) {
            owner.runtime.deathClaimTriggered = true;

            owner.HP = 0;
            owner.alive = false;

            // Clear immediately upon execution.
            owner.runtime.markedByDeathsInevitability = false;

            owner.runtime.hookEffects =
              owner.runtime.hookEffects.filter(
                (effect) =>
                  effect.key !== "death_claim_execution",
              );
          }
        },

        onTurnEnd({ owner, context }) {
          // If the execution did not trigger, the mark expires
          // at the end of the same turn.
          if (context.currentTurn !== this.triggerTurn) return;

          owner.runtime.markedByDeathsInevitability = false;
        },
      };

      console.log(
        `[JEFF][DEATH'S INEVITABILITY] Execution hook scheduled for ${formatChampionName(
          enemy,
        )}. Hook:`,
        hook,
      );

      enemy.runtime.hookEffects ??= [];
      enemy.runtime.hookEffects.push(hook);

      console.log(
        `[JEFF][DEATH'S INEVITABILITY] Hook registered. Current hookEffects for ${formatChampionName(
          enemy,
        )}:`,
        enemy.runtime.hookEffects,
      );

      return damageResult;
    },
  },
];

export default jeffTheDeathSkills;