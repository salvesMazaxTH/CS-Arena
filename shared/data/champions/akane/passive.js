export default {
  key: "violet_severance",
  name: "Violet Severance",

  squishyCritBonus: 40,
  tankCritBonus: 70,
  piercingRatio: 0.70,
  minDefense: 120,

  description() {
    return `Akane cuts for the seam in the guard, never the body behind it. Every hit she lands is a critical. Against a target with less than ${this.minDefense} Defense there is no armor to cut through, so she commits fully to the strike for +${this.squishyCritBonus}% damage. Against a sturdier target she spends some of that edge slipping past their guard instead, ignoring ${this.piercingRatio * 100}% of their Defense for a lesser +${this.tankCritBonus}% crit bonus.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ crit, defender }) {
    const targetDefense = Number(defender?.Defense) || 0;

    if (targetDefense < this.minDefense) {
      return {
        crit: { ...(crit ?? {}), didCrit: true, bonus: this.squishyCritBonus },
      };
    }

    return {
      crit: { ...(crit ?? {}), didCrit: true, bonus: this.tankCritBonus },
      mode: "piercing",
      piercingPercentage: this.piercingRatio * 100,
    };
  },
};
