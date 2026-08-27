import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const rakhanaSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================
  {
    key: "iron_lotus",
    name: "Iron Lotus",

    bf: 75,
    shieldPercent: 15,
    stunDuration: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Strikes an enemy with a powerful iron-infused palm.

      If any Shield is on her when this ability hits, she consumes it to stun the target for ${this.stunDuration} turn and restores HP equal to ${this.shieldPercent}% of her Max HP.

      Otherwise, she gains a Shield equal to ${this.shieldPercent}% of her Max HP after dealing damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime ??= {};
      user.runtime.shields ??= [];

      const hadShield = user.runtime.shields.length > 0;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      // Reflects and counter-attacks ride along in `results` aimed back at her.
      const mainResult = results.find((entry) => entry.targetId === enemy.id);

      if (mainResult.evaded || mainResult.immune) return results;

      const value = Math.floor(
        user.maxHP * (this.shieldPercent / 100),
      );

      if (hadShield) {
        user.runtime.shields.splice(0, 1);

        new HealEvent({
          target: user,
          amount: value,
          context,
          source: user,
        }).execute();

        enemy.applyStatusEffect(
          "stunned",
          this.stunDuration,
          context,
        );

        context.registerDialog?.({
          message: `${formatChampionName(
            user,
          )} consumes her Iron Lotus shield, stunning ${formatChampionName(
            enemy,
          )} and restoring ${value} HP!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      } else {
        user.addShield(value, 0, context);

        context.registerDialog?.({
          message: `${formatChampionName(
            user,
          )} forms an Iron Lotus shield!`,
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "silver_mirror",
    name: "Silver Mirror",

    shieldPercent: 20,
    reflectPercent: 50,
    duration: 1,

    contact: false,
    priority: 3,

    description() {
      return `Rakhana enters a defensive stance and gains a Shield equal to ${this.shieldPercent}% of her Max HP for this turn.

      The first time she is struck while the Shield is active, she reduces that damage by 50% and reflects the prevented damage back to the attacker.

      If the incoming attack is Contact, she also stuns the attacker for 1 turn.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const shieldValue = Math.floor(
        user.maxHP * (this.shieldPercent / 100),
      );

      user.addShield(shieldValue, 0, context);

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "silver_mirror_reflect",
      );

      const reflectPercent = this.reflectPercent;
      let spent = false;

      user.runtime.hookEffects.push({
        key: "silver_mirror_reflect",
        expiresAtTurn: context.currentTurn + this.duration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        name: "Silver Mirror (Reflection)",

        onBeforeDmgTaking({
          defender,
          attacker,
          damage,
          skill,
          context,
        }) {
          if (context.damageDepth > 0 || spent) return;

          const shieldActive =
            Array.isArray(defender.runtime?.shields) &&
            defender.runtime.shields.length > 0;

          if (!shieldActive) return;

          spent = true;

          const reflectedDamage = Math.floor(damage * (reflectPercent / 100));
          const reducedDamage = damage - reflectedDamage;

          context.registerDialog?.({
            message: `<b>[${this.name}]</b> ${formatChampionName(
              defender,
            )} reflects ${reflectedDamage} damage back to ${formatChampionName(
              attacker,
            )}!`,
            sourceId: defender.id,
            targetId: attacker.id,
          });

          context.extraDamageQueue.push({
            mode: DamageEvent.Modes.PIERCING,
            piercingPercentage: 100,
            baseDamage: reflectedDamage,
            attacker: defender,
            defender: attacker,
            type: "physical",

            skill: {
              key: "silver_mirror_counterattack",
              name: "Silver Mirror Counterattack",
              contact: false,
            },

            dialog: {
              message: `${formatChampionName(
                defender,
              )} reflects damage with ${this.name}!`,
              duration: 1000,
            },
          });

          // If the incoming attack was a contact skill, stun the attacker
          if (skill?.contact) {
            attacker.applyStatusEffect("stunned", 1, context);

            context.registerDialog?.({
              message: `${formatChampionName(
                defender,
              )} stuns ${formatChampionName(
                attacker,
              )} with the mirror's reflection!`,
              sourceId: defender.id,
              targetId: attacker.id,
            });
          }

          return {
            damage: reducedDamage,
            log: `<b>[${this.name}]</b> ${formatChampionName(
              defender,
            )} reduces incoming damage by 50% and reflects ${reflectedDamage} damage!`,
          };
        },
      });

      context.registerDialog?.({
        message: `${formatChampionName(
          user,
        )} enters a defensive stance with the Silver Mirror!`,
        sourceId: user.id,
      });

      return [
        {
          log: `<b>${formatChampionName(
            user,
          )}</b> activates <b>${this.name}</b>, gaining a ${shieldValue} HP shield!`,
        },
      ];
    },
  },

  {
    key: "heaven_splitting_descent",
    name: "Heaven-Splitting Descent",

    bf: 115,
    contact: true,
    damageMode: "piercing",

    piercingPercentage: 50,

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    missingHpPercent: 0.25,
    threshold: 0.35,

    description() {
      return `Rakhana descends upon the target with overwhelming force, dealing high damage and ignoring ${this.piercingPercentage}% of the target's Defense.

      If the target is below ${this.threshold * 100}% HP, deals additional Absolute Damage equal to ${this.missingHpPercent * 100}% of their missing HP.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
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

      const results = Array.isArray(result) ? result : [result];

      if (enemy.alive && enemy.HP / enemy.maxHP < this.threshold) {
        const missingHP = enemy.maxHP - enemy.HP;
        const executeDamage = missingHP * this.missingHpPercent;

        const executeResult = new DamageEvent({
          baseDamage: executeDamage,
          mode: DamageEvent.Modes.ABSOLUTE,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(executeResult) ? executeResult : [executeResult]),
        );
      }

      return results;
    },
  },
];

export default rakhanaSkills;
