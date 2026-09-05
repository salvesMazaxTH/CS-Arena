export default {
  key: "blood_owed",
  name: "Blood Owed",

  bonusDmgPercent: 45,
  piercingPercentage: 50,

  description() {
    return `Everything the divine bloodline took from Clay, it now pays back with interest. He deals ${this.bonusDmgPercent}% bonus damage against enemies of divine or demigod blood, and ${this.piercingPercentage}% of that damage goes straight past their Defense.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;
    if (!Array.isArray(defender?.species)) return;
    if (!defender.species.some((s) => s === "divinity" || s === "demigod"))
      return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
      mode: "piercing",
      piercingPercentage: this.piercingPercentage,
    };
  },
};
