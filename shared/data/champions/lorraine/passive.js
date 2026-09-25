import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";

export const DUEL_DURATION = 3;

const riposteSkill = {
  key: "code_of_honor_riposte",
  name: "Code of Honor",
  contact: true,
  hitVfx: "riposte",
};

function duelEntry(owner, context) {
  return owner.tauntEffects?.find(
    (effect) => effect.lorraineDuel && effect.expiresAtTurn > context.currentTurn,
  );
}

function currentDuelTarget(owner, context) {
  const entry = duelEntry(owner, context);
  if (!entry) return null;

  const target = context.allChampions?.get(entry.taunterId);
  return target?.alive ? target : null;
}

function isDuelingWith(owner, enemy, context) {
  return !!enemy && currentDuelTarget(owner, context) === enemy;
}

export function declareDuel(owner, enemy, context) {
  if (currentDuelTarget(owner, context) !== enemy) {
    owner.runtime.lorraineDuelStartTurn = context.currentTurn;
  }

  owner.tauntEffects = owner.tauntEffects.filter((effect) => !effect.lorraineDuel);
  const applied = owner.applyTaunt(enemy.id, DUEL_DURATION, context);
  const added = owner.tauntEffects[owner.tauntEffects.length - 1];
  if (added) added.lorraineDuel = true;

  return applied;
}

// The Duel never lapses on its own: every entry point either renews it or opens a new one.
export function ensureDuel(owner, candidate, context) {
  if (currentDuelTarget(owner, context)) {
    duelEntry(owner, context).expiresAtTurn = context.currentTurn + DUEL_DURATION;
    return null;
  }

  const enemy =
    candidate?.alive && candidate.team !== owner.team
      ? candidate
      : TargetFilter.candidates("enemy", owner, context.aliveChampions ?? []).sort(
          (a, b) => b.Attack - a.Attack,
        )[0];

  if (!enemy) return null;

  declareDuel(owner, enemy, context);
  return enemy;
}

export function turnsInDuel(owner, enemy, context) {
  if (!isDuelingWith(owner, enemy, context)) return null;
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
      en: `Lorraine fights one person at a time and considers everyone else in the room a distraction. She is never without a <b>Duel</b>. Whenever a turn begins and she has none, she names the enemy with the highest <b>Attack</b>; if the named one falls mid-turn, the next opponent she strikes or is struck by takes their place. Against whoever she has named she deals <b>+${this.duelDamagePercent}%</b> damage, and every blow that one aims at her has a <b>${this.parryChance}%</b> chance of being turned aside, blunted by <b>${this.parryReduction}%</b> (<b>Absolute Damage</b> excepted) and answered with a riposte that can never be a <b>critical hit</b>.`,
      pt: `Lorraine luta com uma pessoa de cada vez e trata todo o resto na sala como distração. Ela nunca está sem um <b>Duelo</b>. Sempre que um turno começa e ela não tem nenhum, nomeia o inimigo com maior <b>Ataque</b>; se o nomeado cair no meio do turno, o próximo oponente que ela golpear ou que a golpear toma o lugar dele. Contra quem ela nomeou, causa <b>+${this.duelDamagePercent}%</b> de dano, e todo golpe que esse alvo desferir contra ela tem <b>${this.parryChance}%</b> de chance de ser desviado, reduzido em <b>${this.parryReduction}%</b> (exceto <b>dano Absoluto</b>) e respondido com uma réplica que nunca pode ser <b>acerto crítico</b>.`,
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
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} nomeia ${formatChampionName(named)} e se recusa a olhar para outro lugar.`,
      },
    };
  },

  onBeforeDmgDealing({ owner, attacker, defender, damage, context }) {
    if (!defender) return;

    ensureDuel(owner, defender, context);
    if (!isDuelingWith(owner, defender, context)) return;

    return { damage: Number(damage) * (1 + this.duelDamagePercent / 100) };
  },

  onBeforeDmgTaking({ owner, attacker, defender, damage, context }) {
    if (!attacker) return;

    ensureDuel(owner, attacker, context);
    if (!isDuelingWith(owner, attacker, context)) return;
    if (Math.random() * 100 >= this.parryChance) return;

    context.extraDamageQueue ??= [];
    context.extraDamageQueue.push({
      baseDamage: (owner.Attack * this.riposteBf) / 100,
      attacker: owner,
      defender: attacker,
      skill: riposteSkill,
      type: "physical",
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
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} desvia o golpe e já responde no mesmo movimento.`,
      },
    };
  },
};
