export default {
  key: "corte_perfurante_absoluto",
  name: "Corte Perfurante Absoluto",

  critBonus: 25,
  piercingRatio: 0.75,
  minDefense: 110,
  lowDefenseDamageRatio: 2 / 3,

  description() {
    return `Os ataques de Akane sempre são críticos.

    Seus acertos críticos causam apenas +${this.critBonus}% de dano, mas ignoram ${this.piercingRatio * 100}% da defesa do alvo.
    
    Contra alvos com menos de ${this.minDefense} de Defesa, os ataques não ignoram Defesa e causam apenas ${this.lowDefenseDamageRatio * 100}% do dano.`;
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
