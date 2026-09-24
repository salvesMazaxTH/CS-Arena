const passive = {
  key: "nothing_moves_without_leave",
  name: "Nothing Moves Without Leave",

  speedPerBonusPercent: 2,
  evasionPerSpeedTaken: 25,

  description() {
    return {
      en: `Kazeminus never hurries, nor does he need to: the air itself knows who he is, and every breath across the field moves in his favor, carrying him at the pace it denies everyone else. He deals <b>1%</b> bonus damage for every <b>${this.speedPerBonusPercent}</b> points of <b>Speed</b> he holds over the chosen target. Whenever he steals <b>Speed</b> from an enemy, he gains <b>Evasion</b> equal to <b>${this.evasionPerSpeedTaken}%</b> of what he took, lasting as many turns as the theft itself.`,
      pt: `Kazeminus não se apressa, nem precisa fazê-lo: o próprio ar sabe quem ele é, e cada sopro sobre o campo se move a seu favor, conduzindo-o no ritmo que nega aos outros. Ele causa <b>1%</b> de dano bônus para cada <b>${this.speedPerBonusPercent}</b> pontos de <b>Velocidade</b> que possuir além do alvo escolhido. Sempre que rouba <b>Velocidade</b> de um inimigo, recebe <b>Esquiva</b> equivalente a <b>${this.evasionPerSpeedTaken}%</b> do que lhe tomou, com a mesma duração do roubo.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ owner, defender, damage }) {
    if (!defender || defender.team === owner.team) return;

    const advantage = speedAdvantage(owner, defender);
    if (advantage <= 0) return;

    const bonusPercent = advantage / this.speedPerBonusPercent;

    return { damage: damage * (1 + bonusPercent / 100) };
  },
};

export function speedAdvantage(owner, enemy) {
  return Math.max(0, owner.Speed - (enemy?.Speed ?? 0));
}

// The Evasion is a separate buff that only mirrors the shred's duration.
export function shredSpeed(owner, enemy, amount, duration, context) {
  const { appliedAmount } = enemy.modifyStat({
    statName: "Speed",
    amount: -amount,
    duration,
    context,
    statModifierSrc: owner,
  });

  const taken = Math.abs(appliedAmount);
  if (!taken) return 0;

  const evasion = Math.round((taken * passive.evasionPerSpeedTaken) / 100);
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

export default passive;
