export default {
  key: "violet_severance",
  name: "Violet Severance",

  squishyCritBonus: 40,
  tankCritBonus: 70,
  piercingRatio: 0.70,
  minDefense: 120,

  description() {
    return {
      en: `Akane cuts for the seam in the guard, never the body behind it. Every hit she lands is a <b>critical</b>. Against a target with less than <b>${this.minDefense}</b> <b>Defense</b> there is no armor to cut through, so she commits fully to the strike for <b>+${this.squishyCritBonus}%</b> damage. Against a sturdier target she spends some of that edge slipping past their guard instead, ignoring <b>${this.piercingRatio * 100}%</b> of their <b>Defense</b> for a lesser <b>+${this.tankCritBonus}%</b> crit bonus.`,
      pt: `Akane corta a costura da guarda, nunca o corpo por trás dela. Todo golpe que ela acerta é um <b>crítico</b>. Contra um alvo com menos de <b>${this.minDefense}</b> de <b>Defesa</b> não há armadura para atravessar, então ela se compromete totalmente com o golpe por <b>+${this.squishyCritBonus}%</b> de dano. Contra um alvo mais resistente, ela gasta parte dessa vantagem escorregando pela guarda dele, ignorando <b>${this.piercingRatio * 100}%</b> de sua <b>Defesa</b> por um bônus de crítico menor, de <b>+${this.tankCritBonus}%</b>.`,
    };
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
