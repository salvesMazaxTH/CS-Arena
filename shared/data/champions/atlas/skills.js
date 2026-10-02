import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import totalBlock from "../generic/totalBlock.js";

const atlasSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "gravitic_reckoning",
    name: "Gravitic Reckoning",

    defenseScaling: 85,
    shredAmount: 100,
    adjacentDefenseScaling: 40,
    adjacentShredAmount: 45,

    contact: true,
    damageMode: "standard",
    priority: 1,

    description() {
      return {
        en: `Atlas brings his mace down with the full weight of a falling sky behind it, and the ground gives way well past where it lands. Deals physical damage equal to <b>${this.defenseScaling}%</b> of his <b>Defense</b> to the chosen enemy, breaking <b>${this.shredAmount}</b> <b>Shield</b> off them before the blow lands; whoever stands beside them takes <b>${this.adjacentDefenseScaling}%</b> of his <b>Defense</b> as the ground buckles under them too, breaking <b>${this.adjacentShredAmount}</b> <b>Shield</b>.`,
        pt: `Atlas desce sua maça com todo o peso de um céu em queda, e o chão cede bem além de onde ela pousa. Causa dano físico igual a <b>${this.defenseScaling}%</b> de sua <b>Defesa</b> ao inimigo escolhido, quebrando <b>${this.shredAmount}</b> de <b>Escudo</b> dele antes do golpe; quem estiver ao lado também sofre <b>${this.adjacentDefenseScaling}%</b> de sua <b>Defesa</b> conforme o chão cede sob eles também, quebrando <b>${this.adjacentShredAmount}</b> de <b>Escudo</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      const mainDamage = (user.Defense * this.defenseScaling) / 100;
      const mainResult = new DamageEvent({
        baseDamage: mainDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        shieldBreak: { amount: this.shredAmount },
        context,
        allChampions: context?.allChampions,
      }).execute();

      const mainArr = Array.isArray(mainResult) ? mainResult : [mainResult];
      results.push(...mainArr);

      const mainBroken = mainArr[0]?.shieldBroken || 0;
      if (mainBroken > 0) {
        results.push({
          log: {
            en: `${formatChampionName(enemy)} loses ${mainBroken} Shield to the blow.`,
            pt: `${formatChampionName(enemy)} perde ${mainBroken} de Escudo com o golpe.`,
          },
        });
      }

      const adjacentEnemies = context.getAdjacentChampions(enemy);
      const sideDamage = (user.Defense * this.adjacentDefenseScaling) / 100;

      for (const adjacent of adjacentEnemies) {
        const sideResult = new DamageEvent({
          baseDamage: sideDamage,
          attacker: user,
          defender: adjacent,
          skill: this,
          type: "physical",
          shieldBreak: { amount: this.adjacentShredAmount },
          context,
          allChampions: context?.allChampions,
        }).execute();

        const sideArr = Array.isArray(sideResult) ? sideResult : [sideResult];
        results.push(...sideArr);

        const sideBroken = sideArr[0]?.shieldBroken || 0;
        if (sideBroken > 0) {
          results.push({
            log: {
              en: `${formatChampionName(adjacent)} loses ${sideBroken} Shield to the tremor.`,
              pt: `${formatChampionName(adjacent)} perde ${sideBroken} de Escudo com o tremor.`,
            },
          });
        }
      }

      return results;
    },
  },

  {
    key: "crushing_grip",
    name: "Crushing Grip",

    defenseScaling: 20,
    piercingPercentage: 75,
    snaredDuration: 2,

    contact: false,
    damageMode: "piercing",
    hitVfx: "crushing_grip",
    priority: 3,

    description() {
      return {
        en: `Atlas closes his fist and the ground itself answers, gravity thickening around the chosen enemy until every step costs more than it's worth. Deals physical damage equal to <b>${this.defenseScaling}%</b> of his <b>Defense</b>, with <b>${this.piercingPercentage}%</b> of it ignoring their <b>Defense</b>, and <b>Snares</b> them for <b>${this.snaredDuration}</b> turn(s).`,
        pt: `Atlas fecha o punho e o próprio chão responde, a gravidade se adensando ao redor do inimigo escolhido até que cada passo custe mais do que vale. Causa dano físico igual a <b>${this.defenseScaling}%</b> de sua <b>Defesa</b>, com <b>${this.piercingPercentage}%</b> disso ignorando a <b>Defesa</b> dele, e o deixa <b>Enredado</b> por <b>${this.snaredDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Defense * this.defenseScaling) / 100,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snaredDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "collapsing_firmament",
    name: "Collapsing Firmament",

    defenseScaling: 115,
    shredAmount: 130,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 52,
    priority: 0,

    description() {
      return {
        en: `Atlas stops holding anything back, and the sky he carries comes down on the whole enemy line at once. Deals physical damage to every enemy equal to <b>${this.defenseScaling}%</b> of his <b>Defense</b>, breaking <b>${this.shredAmount}</b> <b>Shield</b> off each of them before it lands.`,
        pt: `Atlas para de segurar qualquer coisa, e o céu que carrega desaba sobre toda a linha inimiga de uma vez. Causa dano físico a todo inimigo igual a <b>${this.defenseScaling}%</b> de sua <b>Defesa</b>, quebrando <b>${this.shredAmount}</b> de <b>Escudo</b> de cada um deles antes do impacto.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = TargetFilter.candidates("enemy", user, targets);
      const baseDamage = (user.Defense * this.defenseScaling) / 100;
      const results = [];

      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          shieldBreak: { amount: this.shredAmount },
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        const broken = arr[0]?.shieldBroken || 0;
        if (broken > 0) {
          results.push({
            log: {
              en: `${formatChampionName(enemy)} loses ${broken} Shield to the collapse.`,
              pt: `${formatChampionName(enemy)} perde ${broken} de Escudo com o desabamento.`,
            },
          });
        }
      }

      return results;
    },
  },
];

export default atlasSkills;
