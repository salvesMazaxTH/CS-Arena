export default {
  key: "scent_of_blood",
  name: "Scent of Blood",

  lowHpThresholdRatio: 0.3,
  bonusDamageRatio: 30,

  description() {
    return `Leone circles until the wound is already open. Against a target at or below ${this.lowHpThresholdRatio * 100}% of their Max HP, his attacks deal +${this.bonusDamageRatio}% bonus damage.`;
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
