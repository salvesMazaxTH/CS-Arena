import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { pushResultLog } from "../../../engine/combat/resultLog.js";

const raliaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "iron_oath",
    name: "Iron Oath",
    bf: 60,
    damageMode: "standard",
    selfDamage: 10,
    defLoss: 30,
    atkBuff: 35,
    buffDuration: 2,
    contact: true,

    priority: 0,
    description() {
      return {
        en: `Rália swears an oath in iron and blood, giving up <b>${this.defLoss}</b> <b>Defense</b> and <b>${this.selfDamage}</b> <b>HP</b> to gain +<b>${this.atkBuff}</b> <b>Attack</b> for <b>${this.buffDuration}</b> turn(s). She then falls upon the chosen target, dealing physical damage.`,
        pt: `Rália faz um juramento de ferro e sangue, abrindo mão de <b>${this.defLoss}</b> de <b>Defesa</b> e <b>${this.selfDamage}</b> de <b>HP</b> para ganhar +<b>${this.atkBuff}</b> de <b>Ataque</b> por <b>${this.buffDuration}</b> turno(s). Em seguida, ela se lança sobre o alvo escolhido, causando dano físico.`,
      };
    },
    targetSpec: ["self", "enemy"],
    resolve({ user, targets, context = {} }) {
      const userName = formatChampionName(user);

      // The oath is sworn in life rather than damage: it ignores shields and
      // never brings Rália below 1 HP. With nothing left to give, there is
      // no oath to swear and the skill fails.
      const hpCost = Math.min(this.selfDamage, user.HP - 1);

      if (hpCost <= 0) {
        context.registerDialog({
          message: `But it failed.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${userName} had no blood left to swear on. <b>Iron Oath</b> failed.`,
        };
      }

      user.modifyStat({
        statName: "Defense",
        amount: -this.defLoss,
        duration: this.buffDuration,
        context,
      });

      // The cost never goes through a DamageEvent, so it registers its own
      // visual event and dialog, or the HP loss lands on the client
      // unannounced — leaving the bar full while lifesteal heals on top of it.
      user.modifyHP(-hpCost, { context });

      context.registerDamage({
        target: user,
        amount: hpCost,
        rawAmount: hpCost,
        sourceId: user.id,
      });

      context.registerDialog({
        message: `${userName} swears the <b>Iron Oath</b> in her own blood!`,
        sourceId: user.id,
        targetId: user.id,
        duration: 1000,
      });

      user.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
      });

      // Immediate follow-up attack.
      const enemy = targets.find((t) => t.id !== user.id);

      const selfLog = {
        en: `${userName} swears the Iron Oath, giving up ${hpCost} HP and ${this.defLoss} Defense for +${this.atkBuff} Attack over ${this.buffDuration} turn(s).`,
        pt: `${userName} faz o Juramento de Ferro, abrindo mão de ${hpCost} de HP e ${this.defLoss} de Defesa por +${this.atkBuff} de Ataque durante ${this.buffDuration} turno(s).`,
      };

      if (!enemy) {
        return { log: selfLog };
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      results[0].log = [selfLog, results[0].log].flat(Infinity).filter(Boolean);

      return results;
    },
  },

  {
    key: "verdict_of_the_field",
    name: "Verdict of the Field",
    bf: 90,
    damageMode: "standard",
    hitVfx: "slash",
    healPercent: 60,
    minHeal: 25,
    killScorePoints: 1,
    contact: true,

    priority: 0,
    description() {
      return {
        en: `Rália passes judgement with her blade, dealing physical damage to the chosen target and taking the sentence back as her own strength: she restores <b>HP</b> equal to <b>${this.healPercent}%</b> of the effective damage dealt, never less than <b>${this.minHeal}</b>. If the judgement is fatal, her player scores <b>${this.killScorePoints}</b> point.`,
        pt: `Rália profere sua sentença com a lâmina, causando dano físico ao alvo escolhido e recolhendo essa sentença de volta como força própria: ela restaura <b>HP</b> igual a <b>${this.healPercent}%</b> do dano efetivo causado, nunca menos que <b>${this.minHeal}</b>. Se a sentença for fatal, seu jogador marca <b>${this.killScorePoints}</b> ponto.`,
      };
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
      // `result` is an array whenever the hit drew a counter-attack or a
      // reflect; the strike on the chosen target is always the first entry.
      const results = Array.isArray(result) ? result : [result];
      const mainResult = results[0];

      const effectiveDamage = mainResult.totalDamage || 0;

      if (effectiveDamage > 0) {
        const healingAmount = Math.max(
          this.minHeal,
          Math.floor(effectiveDamage * (this.healPercent / 100)),
        );

        // Log what she actually recovered, which is less than she asked for when
        // the heal runs into her HP ceiling.
        const healed = new HealEvent({
          target: user,
          amount: healingAmount,
          context,
        }).execute();

        if (healed > 0) {
          pushResultLog(mainResult, {
            en: `${formatChampionName(user)} restores ${healed} HP.`,
            pt: `${formatChampionName(user)} recupera ${healed} de HP.`,
          });
        }
      }

      const didKill = results.some(
        (entry) => entry?.targetId === enemy.id && entry?.killed,
      );

      if (didKill) {
        context.registerScore({
          amount: this.killScorePoints,
          scoringSlot: user.team - 1,
          reason: this.key,
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "decree_of_the_bastion",
    name: "Decree of the Bastion",
    bf: 65,
    damageMode: "piercing",
    hitVfx: "multislash",
    piercingPercentage: 75,

    atkDebuff: 25,
    debuffDuration: 2,
    bleedStacks: 2,

    contact: false,
    isUltimate: true,
    momentumCost: 50,

    priority: 0,
    description() {
      return {
        en: `Rália drives her blade into the ground and lays down her law over the battlefield. For <b>${this.debuffDuration}</b> turn(s), every active enemy suffers −<b>${this.atkDebuff}</b> <b>Attack</b>.

      She then sweeps the field, dealing <b>piercing</b> physical damage (<b>${this.piercingPercentage}%</b> <b>piercing</b>) to all living enemies and leaving <b>${this.bleedStacks}</b> stacks of Bleeding in the wake of her edge.`,
        pt: `Rália crava a lâmina no chão e impõe sua lei sobre o campo de batalha. Por <b>${this.debuffDuration}</b> turno(s), todo inimigo ativo sofre −<b>${this.atkDebuff}</b> de <b>Ataque</b>.

      Em seguida, ela varre o campo, causando dano físico <b>perfurante</b> (<b>${this.piercingPercentage}%</b> de <b>perfuração</b>) a todos os inimigos vivos e deixando <b>${this.bleedStacks}</b> acúmulos de <b>Sangramento</b> no rastro de sua lâmina.`,
      };
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets;

      // The Attack debuff lands before the damage.
      for (const enemy of enemies) {
        enemy.modifyStat({
          statName: "Attack",
          amount: -this.atkDebuff,
          duration: this.debuffDuration,
          context,
        });
      }

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of enemies) {
        const rawResult = new DamageEvent({
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

        const resultsArray = Array.isArray(rawResult) ? rawResult : [rawResult];
        const mainDamage = resultsArray[0];

        results.push(...resultsArray);

        const hitLanded = effectConnected(mainDamage, "bleeding");

        if (hitLanded) {
          enemy.applyStatusEffect(
            "bleeding",
            undefined,
            context,
            {},
            this.bleedStacks,
          );
        }
      }

      return results;
    },
  },
];

export default raliaSkills;
