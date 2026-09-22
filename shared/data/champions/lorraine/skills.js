import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";
import { DUEL_CRIT_DURATION, declareDuel, turnsInDuel } from "./passive.js";

const lorraineSkills = [
  totalBlock,

  {
    key: "terms_of_the_duel",
    name: "Terms of the Duel",

    bf: 60,
    critDuringDuel: 10,
    critDuration: DUEL_CRIT_DURATION,

    ignoresTaunt: true,
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Lorraine names the chosen target out loud, and from that moment nobody else on the field is worth the edge of her blade. Deals <b>physical damage</b> and moves her <b>Duel</b> onto them: she <b>Taunts</b> herself onto the chosen target and can answer nobody else until she names another one, and she gains <b>+${this.critDuringDuel}</b> <b>Critical</b> for <b>${this.critDuration}</b> turn(s).`,
        pt: `Lorraine nomeia o alvo escolhido em voz alta, e a partir desse momento mais ninguém no campo merece o fio de sua espada. Causa <b>dano físico</b> e transfere seu <b>Duelo</b> para ele: ela se autoimpõe <b>Provocar</b> sobre o alvo e não pode responder a mais ninguém até nomear outro, e ganha <b>+${this.critDuringDuel}</b> de <b>Crítico</b> por <b>${this.critDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      declareDuel(user, enemy, context);
      user.modifyStat({
        statName: "Critical",
        amount: this.critDuringDuel,
        duration: this.critDuration,
        context,
        isPermanent: false,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "irrefutable_thrust",
    name: "Irrefutable Thrust",

    bf: 90,
    freshDuelBonus: 30,
    bonusLostPerTurn: 10,
    bleedStacks: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `A duel her family would call proper is decided in the first exchange, and Lorraine has never had the patience for the other kind. Deals <b>physical damage</b>, <b>+${this.freshDuelBonus}%</b> on the turn she names the chosen target and <b>${this.bonusLostPerTurn}%</b> less for every turn her <b>Duel</b> with them has dragged on since, and leaves them <b>Bleeding</b> with <b>${this.bleedStacks}</b> stack(s).`,
        pt: `Um duelo digno do nome de sua família se resolve na primeira troca, e Lorraine nunca teve paciência para o outro tipo. Causa <b>dano físico</b>, <b>+${this.freshDuelBonus}%</b> no turno em que nomeia o alvo escolhido, com <b>${this.bonusLostPerTurn}%</b> a menos para cada turno que o <b>Duelo</b> se arrastar depois disso, e o deixa <b>Sangrando</b> por <b>${this.bleedStacks}</b> stack(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const turns = turnsInDuel(user, enemy, context);
      const bonus =
        turns === null
          ? 0
          : Math.max(0, this.freshDuelBonus - turns * this.bonusLostPerTurn);

      const result = new DamageEvent({
        baseDamage: ((user.Attack * this.bf) / 100) * (1 + bonus / 100),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedStacks, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return results;
    },
  },

  {
    key: "the_killing_pass",
    name: "The Killing Pass",

    bf: 125,
    extraCritChance: 25,
    openedWoundBonus: 30,
    bleedStacks: 2,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Lorraine steps inside the measure one last time and closes the argument the way her family has always closed one. Deals <b>physical damage</b> with an extra <b>${this.extraCritChance}%</b> chance of being a <b>critical hit</b>, <b>+${this.openedWoundBonus}%</b> more if the chosen target is already <b>Bleeding</b>, and leaves them <b>Bleeding</b> with <b>${this.bleedStacks}</b> stack(s).`,
        pt: `Lorraine avança uma última vez e encerra o argumento do jeito que sua família sempre encerrou. Causa <b>dano físico</b> com <b>${this.extraCritChance}%</b> de chance adicional de ser <b>acerto crítico</b>, <b>+${this.openedWoundBonus}%</b> a mais se o alvo escolhido já estiver <b>Sangrando</b>, e o deixa <b>Sangrando</b> por <b>${this.bleedStacks}</b> stack(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const alreadyOpened = enemy.hasStatusEffect("bleeding");
      const forcedCrit = Math.random() * 100 < this.extraCritChance;

      const result = new DamageEvent({
        baseDamage:
          ((user.Attack * this.bf) / 100) *
          (alreadyOpened ? 1 + this.openedWoundBonus / 100 : 1),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        critOptions: forcedCrit ? { force: true } : undefined,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedStacks, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return results;
    },
  },
];

export default lorraineSkills;
