export default {
  key: "flawseeking_blade",
  name: "Flawseeking Blade",

  critBuff: 15,
  critCap: 95,
  critThreshold: 50,
  enhancedCritBonus: 85,

  description() {
    return `Each critical hit increases Vael's Critical by +${this.critBuff}% (up to ${this.critCap}%). Once his Critical exceeds ${this.critThreshold}%, his critical damage bonus is increased to ${this.enhancedCritBonus}%.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onCriticalHit: "attacker",
  },

  onBeforeDmgDealing({ owner, context, crit }) {
    if (owner.Critical > this.critThreshold) {
      owner.critBonusOverride = this.enhancedCritBonus;

      // Return updated crit data so the pipeline can detect the change and recalculate.
      if (crit?.didCrit) {
        return { crit: { ...crit, bonus: this.enhancedCritBonus } };
      }
    } else {
      owner.critBonusOverride = undefined;
    }
  },

  onCriticalHit({ owner, context }) {
    // Increases Critical upon landing a critical hit.
    owner.modifyStat({
      statName: "Critical",
      amount: this.critBuff,
      context,
      isPermanent: true,
    });
  },
};