export default {
  key: "still_water",
  name: "Still Water",

  bonusDamagePercent: 30,
  evasionBonus: 10,
  evasionDuration: 1,

  description() {
    return `Yuki was trained to end a fight in the time it takes an enemy to notice their footing is already gone. Every hit he lands against a Snared enemy deals ${this.bonusDamagePercent}% bonus damage and grants him ${this.evasionBonus} Evasion for ${this.evasionDuration} turn(s).`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || !damage) return;
    if (!defender?.hasStatusEffect?.("snared")) return;

    return { damage: Number(damage) * (1 + this.bonusDamagePercent / 100) };
  },

  onAfterDmgDealing({ attacker, owner, defender, actualDmg, context }) {
    if (attacker !== owner || !(actualDmg > 0)) return;
    if (!defender?.hasStatusEffect?.("snared")) return;

    owner.modifyStat({
      statName: "Evasion",
      amount: this.evasionBonus,
      duration: this.evasionDuration,
      context,
    });
  },
};
