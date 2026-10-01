// shared/data/emblems/dragons_fury.js

import { championHasSpecies } from "../championTraits.js";

// Only a direct hit that reached HP primes the target: DoT ticks and
// hits the shield fully absorbed do not.
function wasDamagedByAlliedDragon(defender, owner, context) {
  const entries = context?.getDamageTakenThisTurn?.(defender.id) ?? [];
  if (!entries.length) return false;

  const championsById = new Map(
    (context.matchChampions ?? []).map((champion) => [champion.id, champion]),
  );

  return entries.some(
    (entry) =>
      !entry.isDot &&
      entry.amount > 0 &&
      entry.sourceTeam === owner.team &&
      championHasSpecies(championsById.get(entry.sourceId), "dragon"),
  );
}

export const dragonsFury = {
  key: "dragons_fury",
  name: "Emblem of the Dragon's Fury",
  damageBonusPercent: 20,

  requirements: {
    species: {
      species: "dragon",
      count: 5,
    },
  },

  description() {
    return {
      en: `Your Dragon champions deal <b>${this.damageBonusPercent}%</b> increased damage to enemies that have already been damaged by an allied Dragon this turn.`,
      pt: `Seus campeões Dragão causam dano <b>${this.damageBonusPercent}%</b> maior a inimigos que já sofreram dano de um Dragão aliado neste turno.`,
    };
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner, context }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (!championHasSpecies(attacker, "dragon")) return;

    if (!wasDamagedByAlliedDragon(defender, owner, context)) return;

    return {
      damage: Number(damage) * (1 + this.damageBonusPercent / 100),
    };
  },
};
