export default {
  key: "ascendant_flame",
  name: "Ascendant Flame",
  enhancedCritBonus: 70,
  atkBuff: 5,
  description() {
    return {
      en: `Vulnara's fire climbs with every clean shot. Each of her <b>critical hits</b> permanently raises her <b>Attack</b> by <b>${this.atkBuff}</b>, and her <b>critical hits</b> strike at <b>1.${this.enhancedCritBonus}x</b> instead of the usual multiplier.`,
      pt: `O fogo de Vulnara cresce a cada tiro certeiro. Cada um dos seus <b>acertos críticos</b> aumenta permanentemente seu <b>Ataque</b> em <b>${this.atkBuff}</b>, e seus <b>acertos críticos</b> golpeiam em <b>1.${this.enhancedCritBonus}x</b> em vez do multiplicador usual.`,
    };
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
