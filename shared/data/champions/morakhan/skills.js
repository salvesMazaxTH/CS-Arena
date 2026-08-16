import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const morakhanSkills = [
  // ========================
  // Basic Strike
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "second_sutra_mantra_of_living_iron",
    name: "Second Sutra: Mantra of Living Iron",
    shieldPercent: 45,
    contact: false,
    priority: 3,

    description() {
      return `During this turn, after taking damage:
      Gains a shield equivalent to ${this.shieldPercent}% of the damage taken.`;
    },

    targetSpec: ["self"],

    resolve({ user, targets, context = {} }) {
      const shieldPercent = this.shieldPercent;

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "mantra_of_living_iron_shield",
      );

      user.runtime.hookEffects.push({
        hookScope: {
          onAfterDmgTaking: "defender",
        },
        key: "mantra_of_living_iron_shield",
        expiresAtTurn: context.currentTurn + 1,
        name: "Mantra of Living Iron (Protection)",

        onAfterDmgTaking({ defender, damage, context }) {
          const shieldAmount = Math.floor(
            damage * (shieldPercent / 100),
          );

          defender.addShield(shieldAmount, 0, context);

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(
              defender,
            )} gained a ${shieldAmount} HP shield (${shieldPercent}% of the damage taken)!`,
          };
        },
      });
    },
  },

  {
    key: "third_sutra_blessing_of_the_mountain_god",
    name: "Third Sutra: Blessing of the Mountain God",

    contact: false,
    priority: 2,

    duration: 1,
    dmgReduct: 20,

    description() {
      return `During this turn, Morakhan and all allies become immune to crowd control and gain ${this.dmgReduct}% damage reduction.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      for (const ally of allies) {
        // 🛡️ Damage reduction via native system
        ally.applyDamageReduction({
          amount: this.dmgReduct,
          duration: this.duration,
          source: this.name,
          type: "percent",
          context,
        });

        // 🚫 CC immunity still requires a hook
        ally.runtime ??= {};
        ally.runtime.hookEffects ??= [];

        // Prevent duplication
        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (e) => e.key !== "blessing_of_the_mountain_god_cc",
        );

        ally.runtime.hookEffects.push({
          key: "blessing_of_the_mountain_god_cc",
          expiresAtTurn: context.currentTurn + this.duration,

          hookScope: {
            onStatusEffectIncoming: "target",
          },

          onStatusEffectIncoming({ target, statusEffect }) {
            if (!statusEffect?.subtypes) return;

            if (
              statusEffect.subtypes.includes("hardCC") ||
              statusEffect.subtypes.includes("softCC")
            ) {
              return {
                cancel: true,
                message: `${formatChampionName(
                  target,
                )} is under the Blessing of the Mountain God and is immune to crowd control!`,
              };
            }
          },
        });
      }

      context.registerDialog({
        message: `${formatChampionName(
          user,
        )} invokes the Blessing of the Mountain God, protecting his allies!`,
        sourceId: user.id,
      });

      return [
        {
          log: `<b>${formatChampionName(
            user,
          )}</b> grants <b>${this.name}</b> to all allies!`,
        },
      ];
    },
  },

  {
    key: "fourth_sutra_mountain_stance",
    name: "Fourth Sutra: Mountain Stance",
    contact: false,

    isUltimate: true,
    momentumCost: 33,

    description() {
      return `Unleashes Mountain Stance. During this turn:
      Becomes immune to crowd control.
      Reflects 50% of all damage taken from abilities.
      Gains an additional 60% damage reduction.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const effect = {
        key: "mountain_stance",

        hookScope: {
          onAfterDmgTaking: "defender",
          onStatusEffectIncoming: "target",
        },

        onAfterDmgTaking({
          defender,
          attacker,
          damage,
          skill,
          context,
        }) {
          if (context.damageDepth > 0) return;

          const reflectedDamage = damage * 0.5;

          context.registerDialog?.({
            message: `<b>[ULTIMATE — ${this.name}]</b> ${formatChampionName(
              defender,
            )} reflects ${Math.floor(
              reflectedDamage,
            )} damage back to the attacker!`,
            sourceId: defender.id,
            targetId: defender.id,
          });

          context.extraDamageQueue.push({
            mode: DamageEvent.Modes.PIERCING,
            piercingPercentage: 100,
            baseDamage: reflectedDamage,
            attacker: defender,
            defender: attacker,
            type: "magical",

            skill: {
              key: "fourth_sutra_mountain_stance_counter",
              name: "Mountain Stance Counterattack",
              contact: true,
            },

            dialog: {
              message: `${formatChampionName(
                defender,
              )} reflects the damage with ${this.name}!`,
              duration: 1000,
            },
          });

          return {
            damage: damage * 0.4,
            log: `[ULTIMATE — ${this.name}] ${formatChampionName(
              defender,
            )} reflects ${Math.floor(
              reflectedDamage,
            )} damage back to the attacker and takes only 40% of the damage!`,
          };
        },

        onStatusEffectIncoming({ target, statusEffect }) {
          if (!statusEffect?.subtypes) return;

          if (
            statusEffect.subtypes.includes("hardCC") ||
            statusEffect.subtypes.includes("softCC")
          ) {
            return {
              cancel: true,
              message: `${formatChampionName(
                target,
              )} is immune to crowd control effects!`,
            };
          }
        },
      };

      user.runtime.hookEffects ??= [];

      // Prevent duplication if the Ultimate is used more than once
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== effect.key,
      );

      user.runtime.hookEffects.push(effect);
    },
  },
];

export default morakhanSkills;