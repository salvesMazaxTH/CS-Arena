import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import basicStrike from "../generic/basicStrike.js";

const tutuSkills = [
  totalBlock,
  basicStrike,
  {
    key: "guardian_charge",
    name: "Guardian Charge",
    bf: 85,
    contact: true,

    shieldAmount: 30,

    priority: 0,
    damageMode: "standard",

    description() {
      return {
        en: `Tutu barrels into the chosen target, dealing physical damage, then plants himself in front of whichever ally is worst off, granting them a <b>${this.shieldAmount}</b> point <b>Shield</b>.`,
        pt: `Tutu investe contra o alvo escolhido, causando dano físico, e então se planta na frente do aliado em pior estado, concedendo a ele um <b>Escudo</b> de <b>${this.shieldAmount}</b> pontos.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const damageResults = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];
      results.push(...damageResults);

      const lowestHealthAlly = context.aliveChampions
        .filter((c) => c.team === user.team && c.id !== user.id)
        .sort((a, b) => a.HP / a.maxHP - b.HP / b.maxHP)[0];

      if (lowestHealthAlly) {
        lowestHealthAlly.addShield(this.shieldAmount, 0, context);
      }

      return results;
    },
  },

  {
    key: "instinctive_taunt",
    name: "Instinctive Taunt",

    tauntDuration: 1,

    priority: 3,

    description() {
      return {
        en: `Tutu plants himself in the way and makes far too much noise, <b>Taunting</b> the chosen target for <b>${this.tauntDuration}</b> turn(s).`,
        pt: `Tutu se planta no caminho e faz barulho demais, deixando o alvo escolhido <b>Provocado</b> por <b>${this.tauntDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);

      const logs = [tauntLog].filter(Boolean);
      logs.unshift({
        log: {
          en: `${formatChampionName(user)} uses <b>Instinctive Taunt</b>. ${formatChampionName(enemy)} is <b>Taunted</b> for <b>${this.tauntDuration}</b> turn(s).`,
          pt: `${formatChampionName(user)} usa <b>Instinctive Taunt</b>. ${formatChampionName(enemy)} fica <b>Provocado</b> por <b>${this.tauntDuration}</b> turno(s).`,
        },
      });
      return logs;
    },
  },
];

export default tutuSkills;
