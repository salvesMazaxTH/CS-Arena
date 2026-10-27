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

// Raises Nerithia's own Attack to the lender's until the end of the turn, so
// the borrowed strength shows on her overlay and feeds every hit she lands.
function borrowAttack(user, context) {
  const lender = strongestAlly(user, context);
  const gap = lender.Attack - user.Attack;

  if (lender !== user && gap > 0) {
    user.modifyStat({
      statName: "Attack",
      amount: gap,
      duration: 1,
      context,
      statModifierSrc: lender,
    });
  }

  return lender;
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
        en: `Nerithia borrows the strength of the mightiest hand beside her and returns it as a bolt of judgement. Her <b>Attack</b> becomes that of her <b>strongest living ally</b> until the end of the turn, then she deals <b>magical damage</b> equal to <b>${this.attackPercent}%</b> of her Attack.`,
        pt: `Nerithia toma emprestada a força da mão mais poderosa ao seu lado e a devolve como um raio de julgamento. Seu <b>Ataque</b> passa a ser o do seu <b>aliado vivo mais forte</b> até o fim do turno, e então ela causa <b>dano mágico</b> igual a <b>${this.attackPercent}%</b> do seu Ataque.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      borrowAttack(user, context);

      return new DamageEvent({
        baseDamage: (user.Attack * this.attackPercent) / 100,
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

    baseAttackPercent: 40,
    attackPercentPerPrayer: 7.5,

    contact: false,
    damageMode: "standard",
    element: "light",
    hitVfx: "radiant_bolt",
    priority: 0,

    description() {
      return {
        en: `Nerithia descends the last step and every prayer she has kept answers at once, pouring the strength of her mightiest ally over the enemy line. Her <b>Attack</b> becomes that of her <b>strongest living ally</b> until the end of the turn, then she deals <b>magical damage</b> to all enemies equal to <b>${this.baseAttackPercent}%</b> of her Attack, plus <b>${this.attackPercentPerPrayer}%</b> for each <b>Prayer</b> held. All her Prayers are spent.`,
        pt: `Nerithia desce o último degrau e todas as preces que guardou respondem de uma só vez, derramando a força do aliado mais poderoso sobre a linha inimiga. Seu <b>Ataque</b> passa a ser o do seu <b>aliado vivo mais forte</b> até o fim do turno, e então ela causa <b>dano mágico</b> a todos os inimigos igual a <b>${this.baseAttackPercent}%</b> do seu Ataque, mais <b>${this.attackPercentPerPrayer}%</b> por cada <b>Prece</b> mantida. Todas as suas Preces são gastas.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const lender = borrowAttack(user, context);

      user.runtime = user.runtime || {};
      const prayers = user.runtime.nerithiaPrayers || 0;
      const percent = this.baseAttackPercent + prayers * this.attackPercentPerPrayer;
      const baseDamage = (user.Attack * percent) / 100;

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
