import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import totalBlock from "../generic/totalBlock.js";

// The sword arm of the kit: whichever living ally (herself included) hits
// hardest lends Nerithia their Attack.
function strongestAlly(user, context) {
  const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);
  const champions = allies.length ? allies : [user];
  return champions.reduce(
    (best, champion) => (champion.Attack > best.Attack ? champion : best),
    champions[0],
  );
}

const nerithiaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "descending_blessing",
    name: "Descending Blessing",

    healAmount: 45,

    contact: false,
    priority: 2,

    description() {
      return {
        en: `Nerithia lowers her palm and a thread of gold light settles on the chosen ally. Restores <b>${this.healAmount}</b> HP. Healing an ally other than herself earns her a <b>Prayer</b>.`,
        pt: `Nerithia baixa a palma da mão e um fio de luz dourada pousa no aliado escolhido. Restaura <b>${this.healAmount}</b> de HP. Curar um aliado que não seja ela mesma lhe rende uma <b>Prece</b>.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;

      const healed = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
        allChampions: context?.allChampions,
      }).execute();

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: {
          en: `${userName} lets a <b>Descending Blessing</b> fall on ${ally === user ? "herself" : allyName}: <b>${healed}</b> HP restored.`,
          pt: `${userName} deixa uma <b>Bênção Descendente</b> cair sobre ${ally === user ? "si mesma" : allyName}: <b>${healed}</b> de HP restaurado.`,
        },
      };
    },
  },

  {
    key: "verdict_from_above",
    name: "Verdict from Above",

    attackPercent: 40,

    contact: false,
    damageMode: "standard",
    element: "light",
    hitVfx: "radiant_bolt",
    priority: 1,

    description() {
      return {
        en: `Nerithia borrows the strength of the mightiest hand beside her and returns it as a bolt of judgement. Deals <b>magical damage</b> equal to <b>${this.attackPercent}%</b> of the <b>highest Attack among her living allies</b> (herself included).`,
        pt: `Nerithia toma emprestada a força da mão mais poderosa ao seu lado e a devolve como um raio de julgamento. Causa <b>dano mágico</b> igual a <b>${this.attackPercent}%</b> do <b>maior Ataque entre seus aliados vivos</b> (ela incluída).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const lender = strongestAlly(user, context);

      return new DamageEvent({
        baseDamage: (lender.Attack * this.attackPercent) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "the_golden_stair",
    name: "The Golden Stair",

    isUltimate: true,
    momentumCost: 55,

    baseAttackPercent: 25,
    attackPercentPerPrayer: 10,

    contact: false,
    damageMode: "standard",
    element: "light",
    hitVfx: "radiant_bolt",
    priority: 0,

    description() {
      return {
        en: `Nerithia descends the last step and every prayer she has kept answers at once, pouring the strength of her mightiest ally over the enemy line. Deals <b>magical damage</b> to all enemies equal to <b>${this.baseAttackPercent}%</b> of the <b>highest Attack among her living allies</b>, plus <b>${this.attackPercentPerPrayer}%</b> for each <b>Prayer</b> held. All her Prayers are spent.`,
        pt: `Nerithia desce o último degrau e todas as preces que guardou respondem de uma só vez, derramando a força do aliado mais poderoso sobre a linha inimiga. Causa <b>dano mágico</b> a todos os inimigos igual a <b>${this.baseAttackPercent}%</b> do <b>maior Ataque entre seus aliados vivos</b>, mais <b>${this.attackPercentPerPrayer}%</b> por cada <b>Prece</b> mantida. Todas as suas Preces são gastas.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const lender = strongestAlly(user, context);

      user.runtime = user.runtime || {};
      const prayers = user.runtime.nerithiaPrayers || 0;
      const percent = this.baseAttackPercent + prayers * this.attackPercentPerPrayer;
      const baseDamage = (lender.Attack * percent) / 100;

      // Spent before the hits land so the ultimate does not carry its own reduction.
      user.runtime.nerithiaPrayers = 0;

      const results = [];
      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(...(Array.isArray(result) ? result : [result]));
      }

      results.push({
        log: {
          en: `${formatChampionName(user)} descends <b>The Golden Stair</b> — ${prayers} Prayer(s) spent, ${formatChampionName(lender)}'s strength poured over the enemy line.`,
          pt: `${formatChampionName(user)} desce <b>A Escadaria Dourada</b> — ${prayers} Prece(s) gasta(s), a força de ${formatChampionName(lender)} derramada sobre a linha inimiga.`,
        },
      });

      return results;
    },
  },
];

export default nerithiaSkills;
