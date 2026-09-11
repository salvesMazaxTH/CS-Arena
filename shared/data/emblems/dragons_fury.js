// shared/data/emblems/dragons_fury.js

function isDragon(champion) {
  if (!champion || !Array.isArray(champion.species)) return false;

  return champion.species.some(
    (species) =>
      typeof species === "string" && species.toLowerCase() === "dragon",
  );
}

function damagedTargetsThisTurn(owner, currentTurn) {
  owner.runtime ??= {};

  const previous = owner.runtime.dragonsFury;
  if (previous?.turn !== currentTurn) {
    owner.runtime.dragonsFury = {
      turn: currentTurn,
      targetIds: new Set(),
    };
  }

  return owner.runtime.dragonsFury.targetIds;
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
    return `Your Dragon champions deal ${this.bonusDmgPercent}% bonus damage to enemies that have already been damaged by an allied Dragon this turn.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner, context }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team || !isDragon(attacker)) return;

    const targetIds = damagedTargetsThisTurn(owner, context?.currentTurn ?? 0);
    if (!targetIds.has(defender.id)) return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },

  onAfterDmgDealing({ attacker, defender, actualDmg, owner, context }) {
    // A missed, blocked, immune, or fully absorbed hit does not prime the
    // target for Dragon's Fury. `actualDmg` is available only after the damage
    // pipeline has applied shields and HP changes.
    if (!attacker || !defender || !owner || !(Number(actualDmg) > 0)) return;
    if (attacker.team !== owner.team || !isDragon(attacker)) return;

    damagedTargetsThisTurn(owner, context?.currentTurn ?? 0).add(defender.id);
  },
};
