import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

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

    hits: [
      {
        id: "counter",
        type: "physical",
        contact: false,
        damageMode: "piercing",
        piercingPercentage: 100,
      },
    ],

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

      const skill = this;
      const piercingDamageBonus = this.piercingDamageBonus;

      ally.addHookEffect({
        type: "buff",
        key: "vital_conductance_counter",
        expiresAtTurn: context.currentTurn + this.buffsDuration,

        hookScope: {
          onEvade: "defender",
        },

        // owner = the buffed ally
        onEvade({ attacker, owner, context }) {
          if (!attacker?.alive || !user.alive) return;

          SkillHits.run(skill, "counter", {
            user,
            target: attacker,
            baseDamage: piercingDamageBonus,
            context,
          });

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
      }, context);

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

    hits: [
      {
        id: "overtake",
        label: "Infinite Horizon",
        type: "physical",
        contact: false,
        damageMode: "piercing",
        piercingPercentage: 100,
      },
    ],

    description() {
      return `Blyskartri pushes the horizon out of reach for the chosen ally. For ${this.effectDuration} turn(s), everything they throw carries +${this.dmgBonus}% raw damage for every ${this.speedPerStack} points of their total Speed.

      And whenever the ally moves before the target they strike, the blow arrives ahead of the defence: +${this.piercingDamageBonus} bonus piercing damage.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.damageModifiers = ally.damageModifiers.filter(
        (mod) => mod.id !== "infinite_horizon",
      );

      ally.addDamageModifier({
        id: "infinite_horizon",
        expiresAtTurn: context.currentTurn + this.effectDuration,
        apply: ({ baseDamage, attacker, skill, hitId }) => {
          // Its own overtake strike is a flat bonus, so it must not scale twice.
          if (skill?.key === this.key && hitId === "overtake") return baseDamage;

          const steps = Math.floor(attacker.Speed / this.speedPerStack);

          return baseDamage * (1 + (steps * this.dmgBonus) / 100);
        },
      });

      const skill = this;
      const piercingDamageBonus = this.piercingDamageBonus;

      ally.runtime.hookEffects ??= [];
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (hook) => hook.key !== "infinite_horizon_overtake",
      );

      ally.addHookEffect({
        type: "buff",
        key: "infinite_horizon_overtake",
        name: "Infinite Horizon",
        expiresAtTurn: context.currentTurn + this.effectDuration,

        hookScope: {
          onAfterDmgDealing: "attacker",
        },

        onAfterDmgDealing({ attacker, defender, damage, context }) {
          if (damage <= 0 || !defender.alive) return;
          if (defender.team === attacker.team) return;

          // Both must have acted this turn for one of them to have been first.
          const moverIndex = context.turnExecutionMap?.get(attacker.id);
          const targetIndex = context.turnExecutionMap?.get(defender.id);

          if (moverIndex === undefined || targetIndex === undefined) return;
          if (moverIndex >= targetIndex) return;

          const overtake = `${formatChampionName(attacker)} strikes ahead of ${formatChampionName(defender)}'s defence!`;

          context.extraDamageQueue.push({
            ...SkillHits.params(skill, "overtake", {
              user: attacker,
              target: defender,
              baseDamage: piercingDamageBonus,
              context,
            }),
            dialog: { message: overtake, duration: 1000 },
          });

          return { log: overtake };
        },
      }, context);

      return {
        log: `${formatChampionName(user)} opens the Horizon for ${formatChampionName(ally)}!`,
      };
    },
  },
];

export default blyskartriSkills;
