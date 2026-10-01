// shared/data/emblems/dragons_fury.js

function isDragon(champion) {
  if (!champion || !Array.isArray(champion.species)) return false;

  return champion.species.some(
    (species) =>
      typeof species === "string" && species.toLowerCase() === "dragon",
  );
}

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
      isDragon(championsById.get(entry.sourceId)),
  );
}

export const dragonsFury = {
  key: "dragons_fury",
  name: "Emblem of the Dragon's Fury",
  bonusDmgPercent: 20,

  requirements: {
    species: {
      species: "dragon",
      count: 5,
    },
  },

  description() {
    return {
      en: `Your Dragon champions deal ${this.bonusDmgPercent}% bonus damage to enemies that have already been damaged by an allied Dragon this turn.`,
      pt: `Seus campeões Dragão causam ${this.bonusDmgPercent}% de dano adicional a inimigos que já sofreram dano de um Dragão aliado neste turno.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner, context }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team || !isDragon(attacker)) return;

    if (!wasDamagedByAlliedDragon(defender, owner, context)) return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },
};
