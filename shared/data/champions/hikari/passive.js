export default {
  key: "venom_reads_the_wound",
  name: "Venom Reads the Wound",

  bonusPerStack: 5,
  maxBonus: 25,

  description() {
    return {
      en: `Hikari always knows how far her venom has already gone, and aims for exactly where it has worked hardest. Against a <b>Poisoned</b> target, everything she deals carries <b>${this.bonusPerStack}</b> bonus damage per <b>Poisoned</b> stack on them, up to <b>${this.maxBonus}</b>.`,
      pt: `Hikari sempre sabe até onde o seu veneno já chegou, e mira exatamente onde ele mais trabalhou. Contra um alvo <b>Envenenado</b>, tudo o que ela causa carrega <b>${this.bonusPerStack}</b> de dano bônus por acúmulo de <b>Envenenado</b> nele, até <b>${this.maxBonus}</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ defender }) {
    const stacks = Number(defender?.getStatusEffect?.("poisoned")?.stacks) || 0;
    if (stacks <= 0) return;

    return {
      bonusDamage: Math.min(this.maxBonus, stacks * this.bonusPerStack),
    };
  },
};
