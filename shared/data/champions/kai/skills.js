import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import kindledFists from "./passive.js";

const kaiSkills = [
  basicStrike,
  {
    key: "quick_hook",
    name: "Quick Hook",
    bf: 60,
    contact: true,
    damageMode: "standard",
    priority: 1,
    description() {
      return `Kai snaps a short hook into the chosen target before they can set their guard, dealing physical damage.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
      // Ensure targetId is set for animation targeting.
      return { ...result, targetId: enemy.id };
    },
  },

  {
    key: "living_ember_stance",
    name: "Living Ember Stance",
    contact: false,
    damageReduction: 25,
    counterAtkDmg: 15,
    stanceDuration: 2,
    burnDuration: 2,
    priority: 2,
    element: "fire",

    description() {
      return `Kai settles into a stance that glows from the inside out, taking ${this.damageReduction}% less damage during this turn and the next.

      Anyone who strikes him in contact is answered on the spot with ${this.counterAtkDmg} piercing damage and left Burning.

      The moment Kai deals damage, the stance catches: Living Ember burns for ${this.stanceDuration} turn(s), his attacks deal +${kindledFists.livingEmberBonusDamage} bonus damage and always apply Burning.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      const counterAtkDmg = this.counterAtkDmg;
      const stanceDuration = this.stanceDuration;
      const burnDuration = this.burnDuration;

      // Signals to the VFX system that the stance is active.
      user.runtime.fireStance = "emberStance";

      const effect = {
        key: "living_ember_stance",
        state: "emberStance", // "emberStance" → "livingEmber"
        expiresAtTurn: context.currentTurn + stanceDuration,

        // 🔥 COUNTERATTACK
        onAfterDmgTaking({ attacker, defender, skill, damage, owner, context }) {
          if (defender !== owner) return;
          if (!skill?.contact) return;
          if (damage <= 0) return;
          if (skill?.key === "living_ember_stance_counter") return;
          if (!attacker?.alive) return;

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "piercing",
            baseDamage: counterAtkDmg,
            piercingPercentage: 100,
            attacker: owner,
            defender: attacker,
            type: "physical",
            skill: {
              key: "living_ember_stance_counter",
              name: "Living Ember Counter",
              contact: true,
            },

            dialog: {
              message: `${formatChampionName(owner)} answers with the Living Ember Stance!`,
              duration: 1000,
            },
          });

          attacker.applyStatusEffect("burning", burnDuration, context, {
            source: owner,
          });

          return {
            log: `${formatChampionName(attacker)} is burned for striking ${formatChampionName(owner)} in contact!`,
          };
        },

        onAfterDmgDealing({ attacker, owner, damage, context }) {
          if (attacker !== owner) return;
          if (damage <= 0) return;

          // 🔥 TRANSITION
          if (
            this.state === "emberStance" &&
            owner.runtime.fireStance !== "livingEmber"
          ) {
            this.state = "livingEmber";
            owner.runtime.fireStance = "livingEmber";
            this.expiresAtTurn = context.currentTurn + stanceDuration;

            return {
              log: "🔥 Living Ember flares to life!",
            };
          }
        },

        // 🔥 AUTOMATIC REMOVAL
        onTurnStart({ owner, context }) {
          if (context.currentTurn >= this.expiresAtTurn) {
            // Signals to the VFX system that the stance is gone.
            owner.runtime.fireStance = null;
          }
        },
      };

      user.runtime.hookEffects.push(effect);

      // Damage reduction granted by the stance.
      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: this.stanceDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} takes the Living Ember Stance!`,
      };
    },
  },
  {
    key: "blazing_fist_barrage",
    name: "Blazing Fist Barrage",
    bf: 0,
    damagePerHit: 40,
    damageMode: "standard",
    hits: 6,
    burningBonus: 10,
    contact: true,

    priority: 0,
    element: "fire",
    isUltimate: true,
    momentumCost: 33,
    description() {
      return `Kai throws himself forward and lets go of everything at once: ${this.hits} blazing punches scatter at random across all enemies, each one dealing ${this.damagePerHit} physical damage.

      Targets already Burning take ${this.burningBonus} bonus damage per punch as the fire finds its way in.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const results = [];
      if (!enemies.length) return results;

      for (let i = 0; i < this.hits; i++) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];

        const directBonus = target.hasStatusEffect("burning")
          ? this.burningBonus
          : 0;

        const result = new DamageEvent({
          baseDamage: this.damagePerHit + directBonus,
          mode: "standard",
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push({ ...result, targetId: target.id });
      }

      return results;
    },
  },
];

export default kaiSkills;
