export default {
  key: "violet_severance",
  name: "Violet Severance",

  critBonus: 25,
  piercingRatio: 0.75,
  minDefense: 120,
  lowDefenseDamagePercent: 65,

  description() {
    return `Akane cuts for the seam in the guard, never the body behind it. Every hit she lands is a critical, though each for only +${this.critBonus}% damage — the edge spends itself slipping past armor, ignoring ${this.piercingRatio * 100}% of the target's Defense. Against a target with less than ${this.minDefense} Defense there is no seam to find: her hits pierce nothing and land for only ${this.lowDefenseDamagePercent}% of their damage.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ crit, defender, damage }) {
    const newCrit = {
      ...(crit ?? {}),
      didCrit: true,
      bonus: this.critBonus,
    };

    const targetDefense = Number(defender?.Defense) || 0;

    if (targetDefense < this.minDefense) {
      return {
        crit: newCrit,
        damage: damage * (this.lowDefenseDamagePercent / 100),
        mode: "standard",
        piercingPercentage: 0,
      };
    }

    return {
      crit: newCrit,
      mode: "piercing",
      piercingPercentage: this.piercingRatio * 100,
    };
  },
};
