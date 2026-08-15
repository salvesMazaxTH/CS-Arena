export default {
  key: "absolute_piercing_slash",
  name: "Absolute Piercing Slash",

  critBonus: 25,
  piercingRatio: 0.75,
  minDefense: 120,
  lowDefenseDamageRatio: 2 / 3,

  description() {
    return `Akane's hits are always critical.

    Her critical hits deal only +${this.critBonus}% damage, but ignore ${this.piercingRatio * 100}% of the target's defense.
    
    Against targets with less than ${this.minDefense} Defense, her hits do not ignore Defense and deal only ${this.lowDefenseDamageRatio * 100}% of the damage.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ crit, defender, damage }) {
    const newCrit = {
      ...(crit ?? {}),
      didCrit: true,
      chance: 100,
      bonus: this.critBonus,
    };

    const targetDefense = Number(defender?.Defense) || 0;

    if (targetDefense < this.minDefense) {
      return {
        crit: newCrit,
        damage: damage * this.lowDefenseDamageRatio,
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
