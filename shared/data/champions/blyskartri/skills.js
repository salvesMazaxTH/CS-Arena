import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const blyskartriSkills = [
  basicStrike,
  {
    key: "amplifying_flow",
    name: "Amplifying Flow",
    speedBuff: 5,
    evasionBuff: 10,
    buffsDuration: 4,

    contact: false,
    priority: 3,

    description() {
      return `Blyskartri opens a current through the chosen ally and lets it run, granting +${this.speedBuff} Speed and +${this.evasionBuff} Evasion for ${this.buffsDuration} turn(s).`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      ally.modifyStat({
        statName: "Evasion",
        amount: this.evasionBuff,
        duration: this.buffsDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} energizes ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "vital_conductance",

    name: "Vital Conductance",

    piercingDamageBonus: 50,

    priority: 1,

    speedBuff: 10,
    // Added on top of the ally's current Evasion, so it triples the total.
    evasionMultiplier: 2,
    fallbackEvasion: 10,
    buffsDuration: 2,

    contact: false,

    description() {
      return `Blyskartri turns the chosen ally into a living conductor for ${this.buffsDuration} turn(s), granting +${this.speedBuff} Speed and tripling their Evasion.

      While the current holds, every attack the ally slips past is answered: the aggressor takes ${this.piercingDamageBonus} piercing damage.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      const evasionAmount =
        ally.Evasion > 0
          ? ally.Evasion * this.evasionMultiplier
          : this.fallbackEvasion;

      ally.modifyStat({
        statName: "Evasion",
        amount: evasionAmount,
        duration: this.buffsDuration,
        context,
      });

      ally.runtime.hookEffects ??= [];

      // Prevent hook stacking
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (h) => h.key !== "vital_conductance_counter",
      );

      const piercingDamageBonus = this.piercingDamageBonus;

      ally.runtime.hookEffects.push({
        key: "vital_conductance_counter",
        expiresAtTurn: context.currentTurn + this.buffsDuration,

        hookScope: {
          onEvade: "defender",
        },

        // owner = the buffed ally
        onEvade({ attacker, owner, context }) {
          if (!attacker || !attacker.alive) return;

          new DamageEvent({
            baseDamage: piercingDamageBonus,
            mode: "piercing",
            piercingPercentage: 100,
            attacker: user,
            defender: attacker,
            skill: {
              key: "vital_conductance_counter",
            },
            type: "physical",
            context,
            allChampions: context?.allChampions,
          }).execute();

          const counterLog = `${formatChampionName(user)} strikes back at ${formatChampionName(attacker)} for attacking his ally!`;

          context.registerDialog({
            message: counterLog,
            sourceId: owner.id,
            targetId: attacker.id,
          });

          return {
            log: counterLog,
          };
        },
      });

      return {
        log: `${formatChampionName(user)} strengthens ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "infinite_horizon",
    name: "Infinite Horizon",
    damageMode: "standard",

    dmgBonus: 3, // Damage bonus per Speed step, as a percentage.
    speedPerStack: 10,

    piercingDamageBonus: 75,

    effectDuration: 2,
    priority: 4,

    contact: false,

    isUltimate: true,
    momentumCost: 55,

    description() {
      return `Blyskartri pushes the horizon out of reach for the chosen ally. For ${this.effectDuration} turn(s), everything they throw carries +${this.dmgBonus}% raw damage for every ${this.speedPerStack} points of their total Speed.

      And whenever the ally moves before the target they strike, the blow arrives ahead of the defence: +${this.piercingDamageBonus} bonus piercing damage.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      const alreadyHasModifier = ally
        .getDamageModifiers()
        .some((mod) => mod.id === "infinite_horizon");

      if (alreadyHasModifier) {
        return {
          log: `${formatChampionName(ally)} is already under the effect of Infinite Horizon.`,
        };
      }

      ally.addDamageModifier({
        id: "infinite_horizon",
        expiresAtTurn: context.currentTurn + this.effectDuration,
        apply: ({ baseDamage, attacker, defender }, eventContext = {}) => {
          // Speed bonus.
          const speed = attacker.Speed;
          const stacks = Math.floor(speed / this.speedPerStack);
          let resultDamage = baseDamage;
          if (stacks > 0) {
            const bonusPercent = stacks * this.dmgBonus;
            const bonusDamage = baseDamage * (bonusPercent / 100);
            resultDamage += bonusDamage;
          }

          // Piercing bonus when the ally acts before the direct target.
          const execIdx = eventContext.executionIndex ?? context.executionIndex;
          const turnMap =
            eventContext.turnExecutionMap ?? context.turnExecutionMap;
          const targetIdx = turnMap?.get(defender?.id);

          const actedBeforeTarget =
            execIdx !== undefined &&
            (targetIdx === undefined || execIdx < targetIdx);

          if (actedBeforeTarget) {
            resultDamage += this.piercingDamageBonus || 0;
          }

          return resultDamage;
        },
      });

      return {
        log: `${formatChampionName(user)} opens the Horizon for ${formatChampionName(ally)}!`,
      };
    },
  },
];

export default blyskartriSkills;
