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
    return {
      en: `Kazeminus never hurries, nor does he need to: the air itself knows who he is, and every breath across the field moves in his favor, carrying him at the pace it denies everyone else. He deals <b>1%</b> bonus damage for every <b>${this.speedPerBonusPercent}</b> points of <b>Speed</b> he holds over the chosen target. Whenever he steals <b>Speed</b> from an enemy, he gains <b>Evasion</b> equal to <b>${this.evasionPerSpeedTaken}%</b> of what he took, for exactly as long as that enemy remains without it.`,
      pt: `Kazeminus não se apressa, nem precisa fazê-lo: o próprio ar sabe quem ele é, e cada sopro sobre o campo se move a seu favor, conduzindo-o no ritmo que nega aos outros. Ele causa <b>1%</b> de dano adicional para cada <b>${this.speedPerBonusPercent}</b> pontos de <b>Velocidade</b> que possuir além do alvo escolhido. Sempre que rouba <b>Velocidade</b> de um inimigo, recebe <b>Esquiva</b> equivalente a <b>${this.evasionPerSpeedTaken}%</b> do que lhe tomou, pelo exato tempo em que aquele inimigo permanecer sem ela.`,
    };
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
