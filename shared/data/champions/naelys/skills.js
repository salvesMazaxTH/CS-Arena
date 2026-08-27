import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const naelysSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================
  {
    key: "pendant_of_the_waves",
    name: "Pendant of the Waves",
    contact: false,
    bf: 80,
    damageMode: "standard",
    priority: 0,
    element: "water",
    selfHealAmount: 50,
    allyHealAmount: 20,

    description() {
      return `Naelys restores ${this.selfHealAmount} HP to herself and ${this.allyHealAmount} HP to an ally, dealing damage to the enemy.`;
    },

    targetSpec: ["enemy", { type: "select:ally", excludesSelf: true }],

    resolve({ user, targets, context = {} }) {
      const [enemy, ally] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      if (enemy) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const damageResults = Array.isArray(damageResult)
          ? damageResult
          : [damageResult];
        results.push(...damageResults);
      }

      const selfHealApplied = new HealEvent({
        target: user,
        amount: this.selfHealAmount,
        context,
        source: user,
      }).execute();

      if (ally) {
        const allyHealApplied = new HealEvent({
          target: ally,
          amount: this.allyHealAmount,
          context,
          source: user,
        }).execute();
      }

      results.push({
        type: "heal",
        userId: user.id,
        targetId: user.id,
        amount: this.selfHealAmount,
        log: `${formatChampionName(user)} restores ${this.selfHealAmount} HP.`,
      });

      if (ally) {
        results.push({
          type: "heal",
          userId: user.id,
          targetId: ally.id,
          amount: this.allyHealAmount,
          log: `${formatChampionName(
            ally,
          )} restores ${this.allyHealAmount} HP.`,
        });
      }

      return results;
    },
  },

  {
    key: "mass_of_the_raging_sea",
    name: "Mass of the Raging Sea",
    contact: false,
    priority: 2,
    element: "water",
    damageReduction: 20,

    description() {
      return `Naelys assumes a maritime stance until the end of the next turn, gaining ${this.damageReduction}% damage reduction. The first time she is hit each turn, she counterattacks the attacker with Basic Strike.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      const effect = {
        key: "mass_of_the_raging_sea",
        expiresAtTurn: context.currentTurn + 2,
        lastTriggerTurn: null,

        onAfterDmgTaking({
          attacker,
          defender,
          damage,
          skill,
          owner,
          context,
        }) {
          if (defender !== owner) return;
          if (damage <= 0) return;

          if (this.lastTriggerTurn === context.currentTurn) return;

          this.lastTriggerTurn = context.currentTurn;

          context.extraDamageQueue ??= [];

          const basic = owner.skills.find((s) => s.key === "basic_strike");

          if (!basic) return;

          const baseDamage = (owner.Attack * basic.bf) / 100;

          context.extraDamageQueue.push({
            mode: "standard",
            baseDamage,
            attacker: owner,
            defender: attacker,
            type: "physical",
            skill: {
              ...basic,
              key: "mass_of_the_raging_sea_counter",
              name: "Raging Sea Counterattack",
            },

            dialog: {
              message: `${formatChampionName(
                owner,
              )} counterattacked with the force of the Raging Sea!`,
              duration: 1000,
            },
          });

          return {
            log: `🌊 ${formatChampionName(
              owner,
            )} counterattacks with the force of the sea!`,
          };
        },
      };

      user.runtime.hookEffects.push(effect);

      user.applyDamageReduction({
        amount: this.damageReduction,
        type: "percent",
        duration: 1,
        context,
      });

      return {
        log: `${formatChampionName(
          user,
        )} assumes the stance of the Raging Sea!`,
      };
    },
  },

  {
    key: "overflow",
    name: "Overflow",
    contact: false,
    damageMode: "standard",
    priority: 3,
    duration: 3,
    maxBonus: 120,
    stacksPerHPLost: 30,
    bonusPerStack: 15,
    element: "water",

    isUltimate: true,
    momentumCost: 40,

    description() {
      return `For ${this.duration} turns, Naelys deals bonus damage based on her lost HP (up to +${this.maxBonus}).`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const { currentTurn } = context;

      user.addDamageModifier({
        id: "overflow",
        expiresAtTurn: currentTurn + this.duration,

        apply: ({ baseDamage, attacker }) => {
          const lostHP = attacker.maxHP - attacker.HP;

          const stacks = Math.floor(lostHP / this.stacksPerHPLost);

          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          return baseDamage + bonus;
        },
      });

      return {
        log: `🌊 ${formatChampionName(user)} unleashes Overflow!`,
      };
    },
  },
];

export default naelysSkills;
