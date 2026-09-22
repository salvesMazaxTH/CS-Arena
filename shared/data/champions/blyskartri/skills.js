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
      return {
        en: `Blyskartri opens a current through the chosen ally and lets it run, granting <b>+${this.speedBuff}</b> <b>Speed</b> and <b>+${this.evasionBuff}</b> <b>Evasion</b> for <b>${this.buffsDuration}</b> turn(s).`,
        pt: `Blyskartri abre uma corrente através do aliado escolhido e a deixa correr, concedendo <b>+${this.speedBuff}</b> de <b>Velocidade</b> e <b>+${this.evasionBuff}</b> de <b>Esquiva</b> por <b>${this.buffsDuration}</b> turno(s).`,
      };
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

    counterDamage: 50,

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
        damageMode: "absolute",
      },
    ],

    description() {
      return {
        en: `Blyskartri turns the chosen ally into a living conductor for <b>${this.buffsDuration}</b> turn(s), granting <b>+${this.speedBuff}</b> <b>Speed</b> and tripling their <b>Evasion</b>.

      While the current holds, every attack the ally slips past is answered: the aggressor takes <b>${this.counterDamage}</b> <b>Absolute Damage</b>.`,
        pt: `Blyskartri transforma o aliado escolhido em um condutor vivo por <b>${this.buffsDuration}</b> turno(s), concedendo <b>+${this.speedBuff}</b> de <b>Velocidade</b> e triplicando sua <b>Esquiva</b>.

      Enquanto a corrente durar, todo ataque que o aliado esquivar é respondido: o agressor sofre <b>${this.counterDamage}</b> de <b>Dano Absoluto</b>.`,
      };
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
      const counterDamage = this.counterDamage;

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
            baseDamage: counterDamage,
            context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
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

    overtakeDamage: 60,

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
        damageMode: "absolute",
      },
    ],

    description() {
      return {
        en: `Blyskartri pushes the horizon out of reach for the chosen ally. For <b>${this.effectDuration}</b> turn(s), everything they throw carries <b>+${this.dmgBonus}%</b> raw damage for every <b>${this.speedPerStack}</b> points of their total <b>Speed</b>.

      And whenever the ally moves before the target they strike, the blow arrives ahead of the defence: <b>${this.overtakeDamage}</b> bonus <b>Absolute Damage</b>.`,
        pt: `Blyskartri empurra o horizonte para fora do alcance do aliado escolhido. Por <b>${this.effectDuration}</b> turno(s), tudo o que ele lançar carrega <b>+${this.dmgBonus}%</b> de dano bruto para cada <b>${this.speedPerStack}</b> pontos de sua <b>Velocidade</b> total.

      E sempre que o aliado agir antes do alvo que atinge, o golpe chega antes da defesa: <b>${this.overtakeDamage}</b> de <b>Dano Absoluto</b> bônus.`,
      };
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
      const overtakeDamage = this.overtakeDamage;

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
              baseDamage: overtakeDamage,
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
