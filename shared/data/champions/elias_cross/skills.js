import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const eliasCrossSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "lightning_impact",
    name: "Lightning Impact",
    bf: 70,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    priority: 0,
    cannotBeEvaded: true,
    element: "lightning",

    description() {
      return {
        en: `Elias Cross doesn't aim so much as complete a circuit. If the target has <b>Conductor</b>, deals <b>${this.damageBonus}</b> bonus damage. This attack <b>cannot be evaded</b>.`,
        pt: `Elias Cross não mira tanto quanto completa um circuito. Se o alvo tiver <b>Condutor</b>, causa <b>${this.damageBonus}</b> de dano bônus. Este ataque <b>não pode ser esquivado</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: enemy.hasStatusEffect("conductor") ? this.damageBonus : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "latent_charge",
    name: "Latent Charge",
    bf: 25,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    priority: 0,
    element: "lightning",

    passiveChanceBonus: 35,
    conductorDuration: 2,

    description() {
      return {
        en: `He lets the current build under his skin before letting it go, marking whatever it touches to carry the next one further. Elias Cross gains <b>+${this.passiveChanceBonus}%</b> Passive chance this turn and the next. If the target has <b>Conductor</b>, deals <b>${this.damageBonus}</b> bonus damage. Marks the target as a <b>Conductor</b> for <b>${this.conductorDuration}</b> turn(s).`,
        pt: `Ele deixa a corrente se acumular sob a própria pele antes de soltá-la, marcando o que ela tocar para levar a próxima ainda mais longe. Elias Cross ganha <b>+${this.passiveChanceBonus}%</b> de chance da Passiva neste turno e no próximo. Se o alvo tiver <b>Condutor</b>, causa <b>${this.damageBonus}</b> de dano bônus. Marca o alvo como <b>Condutor</b> por <b>${this.conductorDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      // The amount actually applied is stored so expiry can remove exactly it.
      const currentChance =
        user.runtime.passiveChance ?? user.passive.initialChance;

      const nextChance = Math.min(
        100,
        currentChance + this.passiveChanceBonus,
      );
      const appliedBonus = Math.max(
        0,
        nextChance - currentChance,
      );

      user.runtime.passiveChance = nextChance;

      if (appliedBonus > 0) {
        user.runtime.passiveTempBuffs ??= [];

        user.runtime.passiveTempBuffs.push({
          amount: appliedBonus,
          expiresAtTurn: (context?.currentTurn ?? 0) + 2,
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: enemy.hasStatusEffect("conductor") ? this.damageBonus : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
        sourceSkill: this,
      });

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "lightning_storm",
    name: "Lightning Storm",
    bf: 120,

    damageMode: "standard",

    isUltimate: true,
    momentumCost: 66,

    recoilDamage: 25,
    reducedDamagePercent: 20,
    recoilDamageMode: "absolute",

    cannotBeEvaded: true,

    contact: false,
    priority: 0,

    element: "lightning",

    description() {
      return {
        en: `There is no controlling what pours out of an empty vessel — only surviving what it takes on the way through. Elias Cross opens completely, and the storm answers. Deals damage to <b>ALL</b> characters except Elias Cross. Characters with <b>Lightning</b> or <b>Earth Affinity</b> take only <b>${this.reducedDamagePercent}%</b> damage. However, Elias Cross takes <b>Absolute Recoil Damage</b> equal to <b>${this.recoilDamage}%</b> of his <b>Max HP</b>. Targets below <b>17%</b> HP are <b>obliterated</b>, or below <b>25%</b> HP if they have <b>Conductor</b>. This attack <b>cannot be evaded</b>.`,
        pt: `Não há como controlar o que transborda de um recipiente vazio — só sobreviver ao que ele leva pelo caminho. Elias Cross se abre por completo, e a tempestade responde. Causa dano a <b>TODOS</b> os personagens, exceto Elias Cross. Personagens com <b>Afinidade de Raio</b> ou <b>Terra</b> sofrem apenas <b>${this.reducedDamagePercent}%</b> do dano. Porém, Elias Cross sofre <b>Dano de Recuo Absoluto</b> igual a <b>${this.recoilDamage}%</b> do seu <b>HP Máximo</b>. Alvos abaixo de <b>17%</b> de HP são <b>obliterados</b>, ou abaixo de <b>25%</b> de HP se tiverem <b>Condutor</b>. Este ataque <b>não pode ser esquivado</b>.`,
      };
    },

    finishingType: "obliterate",

    finishingRule(ctx) {
      const target = ctx.defender;
      const hasOverload =
        target.hasStatusEffect("conductor");

      return hasOverload ? 0.25 : 0.17;
    },

    targetSpec: ["all"],

    resolve({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      // The recoil rides the last struck target, so it can never cut the storm short.
      const recoilIndex = targetList.findLastIndex(
        (t) => t?.alive && t !== user,
      );

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (!user.alive) break;
        if (!target?.alive) continue;
        if (target === user) continue;

        const affinities = target.elementalAffinities || [];

        let finalBaseDamage = baseDamage;

        if (
          affinities.includes("lightning") ||
          affinities.includes("earth")
        ) {
          finalBaseDamage =
            baseDamage *
            (this.reducedDamagePercent / 100);
        }

        if (i === recoilIndex) {
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            baseDamage:
              (user.maxHP * this.recoilDamage) / 100,
            mode: this.recoilDamageMode,
            attacker: user,
            defender: user,
            type: "magical",
            skill: this,
          });
        }

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) {
          results.push(...result);
        } else if (result) {
          results.push(result);
        }
      }

      const eliasUltLog = `${formatChampionName(
        user,
      )} took ${this.recoilDamage}% of his Max HP as Absolute Recoil Damage.`;

      // Inject into a single result (the first valid one).
      if (results.length > 0) {
        results[0].log =
          (results[0].log ?? "") +
          `\n${eliasUltLog}`;
      } else {
        // Optional fallback.
        console.warn(
          "Lightning Storm: no result available to append recoil log",
        );
      }

      return results;
    },
  },
];

export default eliasCrossSkills;