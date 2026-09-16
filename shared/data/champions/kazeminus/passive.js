export const SPEED_PER_BONUS_PERCENT = 2;
export const EVASION_PER_SPEED_TAKEN = 25;

export function speedAdvantage(owner, enemy) {
  return Math.max(0, Number(owner.Speed) - Number(enemy?.Speed ?? 0));
}

// The Evasion rides the same duration as the shred, so the air he took is the
// only air holding him up.
export function shredSpeed(owner, enemy, amount, duration, context) {
  const { appliedAmount } = enemy.modifyStat({
    statName: "Speed",
    amount: -amount,
    duration,
    context,
    statModifierSrc: owner,
  });

  const taken = Math.abs(Number(appliedAmount) || 0);
  if (!taken) return 0;

  const evasion = Math.round((taken * EVASION_PER_SPEED_TAKEN) / 100);
  if (evasion > 0) {
    owner.modifyStat({
      statName: "Evasion",
      amount: evasion,
      duration,
      context,
    });
  }

  return taken;
}

export default {
  key: "nothing_moves_without_leave",
  name: "Nothing Moves Without Leave",

  speedPerBonusPercent: SPEED_PER_BONUS_PERCENT,
  evasionPerSpeedTaken: EVASION_PER_SPEED_TAKEN,

  description() {
      return `Kazeminus does not hurry and does not need to: the air itself knows who he is, and every breath upon the field moves by his favor, carrying him at the pace it denies to others. He deals 1% bonus damage for every ${this.speedPerBonusPercent} points of Speed he holds over the chosen target. Whenever he takes Speed away from an enemy, he gains Evasion equal to ${this.evasionPerSpeedTaken}% of what he took, for exactly as long as that enemy goes without it.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ owner, attacker, defender, damage }) {
    if (attacker !== owner || !defender) return;
    if (defender.team === owner.team) return;

    const advantage = speedAdvantage(owner, defender);
    if (advantage <= 0) return;

    const bonusPercent = advantage / this.speedPerBonusPercent;

    return { damage: Number(damage) * (1 + bonusPercent / 100) };
  },
};
