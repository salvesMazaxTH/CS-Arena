export default {
  key: "flawseeking_blade",
  name: "Flawseeking Blade",

  critBuff: 15,
  critThreshold: 50,
  enhancedCritBonus: 85,

  description() {
    return {
      en: `Each critical hit increases Vael's <b>Critical</b> by +<b>${this.critBuff}%</b>. Once his <b>Critical</b> exceeds <b>${this.critThreshold}%</b>, his critical damage bonus is increased to <b>${this.enhancedCritBonus}%</b>.`,
      pt: `Cada acerto crítico aumenta o <b>Crítico</b> de Vael em +<b>${this.critBuff}%</b>. Quando seu <b>Crítico</b> ultrapassa <b>${this.critThreshold}%</b>, seu bônus de dano crítico sobe para <b>${this.enhancedCritBonus}%</b>.`,
    };
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
