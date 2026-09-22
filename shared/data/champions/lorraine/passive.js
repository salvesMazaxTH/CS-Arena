import { formatChampionName } from "../../../ui/formatters.js";

export const DUEL_DURATION = 3;
export const DUEL_CRIT_DURATION = 3;

const riposteSkill = {
  key: "code_of_honor_riposte",
  name: "Code of Honor",
  contact: true,
  hitVfx: "riposte",
};

function currentDuelTarget(owner, context) {
  const live = owner.tauntEffects?.find(
    (effect) => effect.expiresAtTurn > context.currentTurn,
  );
  if (!live) return null;

  const target = context.allChampions?.get(live.taunterId);
  return target?.alive ? target : null;
}

export function declareDuel(owner, enemy, context) {
  if (currentDuelTarget(owner, context) !== enemy) {
    owner.runtime.lorraineDuelStartTurn = context.currentTurn;
  }

  owner.tauntEffects = [];
  return owner.applyTaunt(enemy.id, DUEL_DURATION, context);
}

// The Duel never lapses on its own: every entry point either renews it or opens a new one.
export function ensureDuel(owner, candidate, context) {
  if (currentDuelTarget(owner, context)) {
    for (const effect of owner.tauntEffects) {
      effect.expiresAtTurn = context.currentTurn + DUEL_DURATION;
    }
    return null;
  }

  const enemy =
    candidate?.alive && candidate.team !== owner.team
      ? candidate
      : (context.aliveChampions ?? [])
          .filter((champ) => champ.team !== owner.team)
          .sort((a, b) => b.Attack - a.Attack)[0];

  if (!enemy) return null;

  declareDuel(owner, enemy, context);
  return enemy;
}

export function turnsInDuel(owner, enemy, context) {
  if (!enemy || !owner.isTauntedBy(enemy.id)) return null;
  const start = owner.runtime.lorraineDuelStartTurn ?? context.currentTurn;
  return Math.max(0, context.currentTurn - start);
}

export default {
  key: "code_of_honor",
  name: "Code of Honor",

  duelDamagePercent: 15,
  parryChance: 35,
  parryReduction: 80,
  riposteBf: 35,

  description() {
    return {
      en: `Lorraine fights one person at a time and considers everyone else in the room a distraction. She is never without a <b>Duel</b>: the first opponent she strikes or is struck by is named on the spot, and if that one falls the most dangerous survivor inherits the quarrel. Against whoever she has named she deals <b>+${this.duelDamagePercent}%</b> damage, and every blow that one aims at her has a <b>${this.parryChance}%</b> chance of being turned aside, blunted by <b>${this.parryReduction}%</b> (<b>Absolute Damage</b> excepted) and answered with a riposte that can never be a <b>critical hit</b>.`,
      pt: `Lorraine luta com uma pessoa de cada vez e trata todo o resto na sala como distração. Ela nunca está sem um <b>Duelo</b>: o primeiro oponente que ela acerta ou de quem leva um golpe é nomeado ali mesmo, e se esse cair, o sobrevivente mais perigoso herda a rixa. Contra quem ela nomeou, causa <b>+${this.duelDamagePercent}%</b> de dano, e todo golpe que esse alvo desferir contra ela tem <b>${this.parryChance}%</b> de chance de ser desviado, reduzido em <b>${this.parryReduction}%</b> (exceto <b>dano Absoluto</b>) e respondido com uma réplica que nunca pode ser <b>acerto crítico</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
  },

  onTurnStart({ owner, context }) {
    const named = ensureDuel(owner, null, context);
    if (!named) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} names ${formatChampionName(named)} and refuses to look anywhere else.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} nomeia ${formatChampionName(named)} e se recusa a olhar para outro lugar.`,
      },
    };
  },

  onBeforeDmgDealing({ owner, attacker, defender, damage, context }) {
    if (attacker !== owner || !defender) return;

    ensureDuel(owner, defender, context);
    if (!owner.isTauntedBy(defender.id)) return;

    return { damage: Number(damage) * (1 + this.duelDamagePercent / 100) };
  },

  onBeforeDmgTaking({ owner, attacker, defender, damage, context }) {
    if (defender !== owner || !attacker) return;

    ensureDuel(owner, attacker, context);
    if (!owner.isTauntedBy(attacker.id)) return;
    if (Math.random() * 100 >= this.parryChance) return;

    context.extraDamageQueue ??= [];
    context.extraDamageQueue.push({
      baseDamage: (owner.Attack * this.riposteBf) / 100,
      attacker: owner,
      defender: attacker,
      skill: riposteSkill,
      type: "physical",
      contact: true,
      mode: "standard",
      critOptions: { disable: true },
    });

    context.registerDialog?.({
      message: {
        en: `${formatChampionName(owner)} catches the blade on hers and turns it aside — the answer is already on its way back.`,
        pt: `${formatChampionName(owner)} apara a lâmina com a sua própria e a desvia — a resposta já está a caminho.`,
      },
      sourceId: owner.id,
      targetId: attacker.id,
    });

    return {
      defenseVfx: "parry",
      damage: Number(damage) * (1 - this.parryReduction / 100),
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} turns the blow aside and answers it in the same motion.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} desvia o golpe e já responde no mesmo movimento.`,
      },
    };
  },
};
