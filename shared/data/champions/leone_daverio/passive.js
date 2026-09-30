export default {
  key: "scent_of_blood",
  name: "Scent of Blood",

  lowHpPercent: 30,
  damageBonusPercent: 30,

  description() {
    return {
      en: `Leone circles until the wound is already open. Against a target at or below <b>${this.lowHpPercent}%</b> of their <b>Max HP</b>, his attacks deal <b>${this.damageBonusPercent}%</b> increased damage.`,
      pt: `Leone ronda a presa até que a ferida já esteja aberta. Contra um alvo com <b>${this.lowHpPercent}%</b> ou menos do <b>HP Máximo</b>, seus ataques causam dano <b>${this.damageBonusPercent}%</b> maior.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ defender, damage }) {
    if (!damage || !defender?.maxHP) return;
    if (defender.HP > (defender.maxHP * this.lowHpPercent) / 100) return;

    return { damage: Number(damage) * (1 + this.damageBonusPercent / 100) };
  },
};
