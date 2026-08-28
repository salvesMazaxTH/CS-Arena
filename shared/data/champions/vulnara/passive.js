export default {
  key: "ascendant_flame",
  name: "Ascendant Flame",
  enhancedCritBonus: 70,
  atkBuff: 5,
  description() {
    return `Vulnara's fire climbs with every clean shot. Each of her critical hits permanently raises her Attack by ${this.atkBuff}, and her critical hits strike at 1.${this.enhancedCritBonus}x instead of the usual multiplier.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onCriticalHit: "attacker",
  },

  onBeforeDmgDealing({ owner, crit }) {
    // Her critical bonus is always the enhanced one.
    owner.critBonusOverride = this.enhancedCritBonus;
    // Return the updated crit so the pipeline detects the change and recomposes it.
    if (crit?.didCrit) {
      return { crit: { ...crit, bonus: this.enhancedCritBonus } };
    }
  },

  onCriticalHit({ owner, context }) {
    owner.modifyStat({
      statName: "Attack",
      amount: this.atkBuff,
      context,
      isPermanent: true,
    });
  },
};
