export default {
  key: "scent_of_blood",
  name: "Scent of Blood",

  lowHpThresholdRatio: 0.3,
  bonusDamageRatio: 30,

  description() {
    return {
      en: `Leone circles until the wound is already open. Against a target at or below <b>${this.lowHpThresholdRatio * 100}%</b> of their Max HP, his attacks deal <b>+${this.bonusDamageRatio}%</b> bonus damage.`,
      pt: `Leone ronda a presa até que a ferida já esteja aberta. Contra um alvo com <b>${this.lowHpThresholdRatio * 100}%</b> ou menos do HP Máximo, seus ataques causam <b>+${this.bonusDamageRatio}%</b> de dano adicional.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || !damage) return;
    if (!defender?.maxHP) return;

    const threshold = defender.maxHP * this.lowHpThresholdRatio;
    if (defender.HP > threshold) return;

    return { damage: Number(damage) * (1 + this.bonusDamageRatio / 100) };
  },
};
