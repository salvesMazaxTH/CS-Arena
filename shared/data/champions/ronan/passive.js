import { formatChampionName } from "../../../ui/formatters.js";

export const FIXATION_DURATION = 2;

// Ronan only ever answers one person at a time, so an older grudge is dropped
// rather than stacked. Re-fixating on the same target only refreshes the timer,
// with no fresh announcement.
export function fixateOn(owner, enemy, duration, context) {
  if (owner.isTauntedBy(enemy.id)) {
    for (const effect of owner.tauntEffects) {
      effect.expiresAtTurn = context.currentTurn + duration;
    }
    return null;
  }

  owner.tauntEffects = [];
  return owner.applyTaunt(enemy.id, duration, context);
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
    return `Ronan carries Ignisar's blood and none of Ignisar's patience. Every time he is wounded he gains +${this.attackPerHitTaken} Attack, and every ${this.hitsDealtPerGain} blows he lands give him +${this.attackPerHitsDealt} more, up to +${this.maxAttackBonus} in total — but being healed cools him down, costing him ${this.attackLostOnHeal} of it.

    He also cannot let a hit go. Whoever wounds him last has his whole attention for ${FIXATION_DURATION} turn(s): he Taunts himself onto them and can answer nobody else, and he deals +${this.fixationBonusPercent}% damage to them for as long as it lasts.`;
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
      logs.push(
        `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} takes it personally and gains +${gained} Attack.`,
      );
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
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} is getting into it and gains +${gained} Attack.`,
    };
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;
    if (!owner.isTauntedBy(defender.id)) return;

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
      log: `<b>[Passive — ${this.name}]</b> Being looked after cools ${formatChampionName(owner)} down, costing him ${lost} Attack.`,
    };
  },
};
