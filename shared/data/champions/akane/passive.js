export default {
  key: "violet_severance",
  name: "Violet Severance",

  squishyCritBonus: 40,
  tankCritBonus: 70,
  piercingPercentage: 70,
  minDefense: 120,

  description() {
    return {
      en: `Akane cuts for the seam in the guard, never the plate around it. Every hit she lands is always a <b>critical hit</b>, regardless of her <b>Critical</b> chance. Against a target with less than <b>${this.minDefense}</b> <b>Defense</b> there is no seam worth hunting, and a clean cut is enough: her critical hits deal <b>+${this.squishyCritBonus}%</b> damage. Against a sturdier target she reads the armor and drives the blade through its gaps, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b> and dealing <b>+${this.tankCritBonus}%</b> critical damage.`,
      pt: `Akane corta a costura da guarda, nunca a placa ao redor dela. Todo golpe que ela acerta é sempre um <b>acerto crítico</b>, independentemente de sua chance de <b>Crítico</b>. Contra um alvo com menos de <b>${this.minDefense}</b> de <b>Defesa</b> não há costura a caçar, e um corte limpo basta: seus acertos críticos causam <b>+${this.squishyCritBonus}%</b> de dano. Contra um alvo mais resistente, ela lê a armadura e crava a lâmina por suas frestas, ignorando <b>${this.piercingPercentage}%</b> de sua <b>Defesa</b> e causando <b>+${this.tankCritBonus}%</b> de dano crítico.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ crit, defender }) {
    const targetDefense = Number(defender?.Defense) || 0;

    if (targetDefense < this.minDefense) {
      return {
        crit: { ...(crit ?? {}), didCrit: true, forced: true, bonus: this.squishyCritBonus },
      };
    }

    return {
      crit: { ...(crit ?? {}), didCrit: true, forced: true, bonus: this.tankCritBonus },
      mode: "piercing",
      piercingPercentage: this.piercingPercentage,
    };
  },
};
