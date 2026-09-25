import { formatChampionName } from "../../../ui/formatters.js";

export const FIXATION_DURATION = 2;

// Ronan only ever answers one person at a time, so an older grudge of his own
// is dropped rather than stacked.
export function fixateOn(owner, enemy, duration, context, { chosen = false } = {}) {
  const chosenUntil = owner.runtime.ronanChosenUntilTurn ?? 0;
  const chosenHolds =
    chosenUntil > context.currentTurn &&
    context.aliveChampions.some(
      (champ) => champ.id === owner.runtime.ronanChosenTargetId,
    );

  if (!chosenHolds) {
    delete owner.runtime.ronanChosenUntilTurn;
    delete owner.runtime.ronanChosenTargetId;
  } else if (!chosen) {
    return null;
  }

  if (chosen) {
    owner.runtime.ronanChosenUntilTurn = context.currentTurn + duration;
    owner.runtime.ronanChosenTargetId = enemy.id;
  }

  const fixation = owner.tauntEffects.find((effect) => effect.ronanFixation);

  if (fixation?.taunterId === enemy.id) {
    fixation.expiresAtTurn = context.currentTurn + duration;
    return null;
  }

  if (fixation) {
    owner.tauntEffects = owner.tauntEffects.filter(
      (effect) => effect !== fixation,
    );
  }

  const applied = owner.applyTaunt(enemy.id, duration, context);
  const added = owner.tauntEffects[owner.tauntEffects.length - 1];
  if (added) added.ronanFixation = true;

  return applied;
}

export default {
  key: "short_fuse",
  name: "Short Fuse",

  attackPerHitTaken: 10,
  hitsDealtPerGain: 2,
  attackPerHitsDealt: 5,
  attackLostOnHeal: 5,
  maxAttackBonus: 150,

  fixationBonusPercent: 35,

  description() {
    return {
      en: `Ronan carries Ignisar's blood and none of Ignisar's patience. Every time he is wounded he gains <b>+${this.attackPerHitTaken}</b> Attack, and every <b>${this.hitsDealtPerGain}</b> blows he lands give him <b>+${this.attackPerHitsDealt}</b> more, up to <b>+${this.maxAttackBonus}</b> in total — but being healed cools him down, costing him <b>${this.attackLostOnHeal}</b> of it.

      He also cannot let a hit go. Whoever wounds him last has his whole attention for <b>${FIXATION_DURATION}</b> turn(s): he <b>Taunts</b> himself onto them and can answer nobody else, and he deals <b>+${this.fixationBonusPercent}%</b> damage to them for as long as it lasts — unless he has picked a fight of his own, which nothing rewrites until it runs out.`,
      pt: `Ronan tem o sangue de Ignisar nas veias — a paciência, essa ele nunca herdou. Toda vez que é ferido, ganha <b>+${this.attackPerHitTaken}</b> de Ataque, e a cada <b>${this.hitsDealtPerGain}</b> golpes que desfere ganha mais <b>+${this.attackPerHitsDealt}</b>, até um total de <b>+${this.maxAttackBonus}</b> — mas ser curado o esfria, custando <b>${this.attackLostOnHeal}</b> desse bônus.

      Ele também não consegue deixar um golpe passar em branco. Quem quer que o fira por último tem toda a sua atenção por <b>${FIXATION_DURATION}</b> turno(s): ele se <b>Provoca</b> contra esse alvo e não consegue responder a mais ninguém, causando <b>+${this.fixationBonusPercent}%</b> de dano contra ele enquanto durar — a menos que já tenha escolhido sua própria briga, o que nada muda até se esgotar.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
    onAfterHealing: "healTarget",
  },

  stokeRage(owner, amount, context) {
    const current = owner.runtime.ronanRage ?? 0;
    const allowed = Math.min(amount, this.maxAttackBonus - current);
    if (allowed <= 0) return 0;

    owner.runtime.ronanRage = current + allowed;
    owner.modifyStat({
      statName: "Attack",
      amount: allowed,
      context,
      isPermanent: true,
      statModifierSrc: owner,
    });

    return allowed;
  },

  onAfterDmgTaking({ owner, attacker, actualDmg, context }) {
    if (!(actualDmg > 0)) return;

    const logs = [];

    if (attacker && attacker.team !== owner.team) {
      const taunt = fixateOn(owner, attacker, FIXATION_DURATION, context);
      if (taunt?.log) logs.push(taunt.log);
    }

    const gained = this.stokeRage(owner, this.attackPerHitTaken, context);
    if (gained) {
      logs.push({
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} takes it personally and gains +${gained} Attack.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} leva para o lado pessoal e ganha +${gained} de Ataque.`,
      });
    }

    return logs.length ? { logs } : undefined;
  },

  onAfterDmgDealing({ owner, actualDmg, context }) {
    if (!(actualDmg > 0)) return;

    owner.runtime.ronanHitsDealt = (owner.runtime.ronanHitsDealt ?? 0) + 1;
    if (owner.runtime.ronanHitsDealt % this.hitsDealtPerGain !== 0) return;

    const gained = this.stokeRage(owner, this.attackPerHitsDealt, context);
    if (!gained) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} is getting into it and gains +${gained} Attack.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} entra no ritmo da briga e ganha +${gained} de Ataque.`,
      },
    };
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;

    const fixated = owner.tauntEffects.some(
      (effect) => effect.ronanFixation && effect.taunterId === defender.id,
    );
    if (!fixated) return;

    return { damage: Number(damage) * (1 + this.fixationBonusPercent / 100) };
  },

  onAfterHealing({ owner, healTarget, amount, context }) {
    if (healTarget !== owner || !(amount > 0)) return;

    const current = owner.runtime.ronanRage ?? 0;
    const lost = Math.min(this.attackLostOnHeal, current);
    if (lost <= 0) return;

    owner.runtime.ronanRage = current - lost;
    owner.modifyStat({
      statName: "Attack",
      amount: -lost,
      context,
      isPermanent: true,
      statModifierSrc: owner,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> Being looked after cools ${formatChampionName(owner)} down, costing him ${lost} Attack.`,
        pt: `<b>[Passiva — ${this.name}]</b> Ser cuidado esfria ${formatChampionName(owner)}, custando ${lost} de Ataque.`,
      },
    };
  },
};
