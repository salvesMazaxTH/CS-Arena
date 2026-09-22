export default {
  key: "blood_owed",
  name: "Blood Owed",

  bonusDmgPercent: 45,
  piercingPercentage: 50,

  description() {
    return {
      en: `Everything the divine bloodline took from Clay, it now pays back with interest. He deals <b>${this.bonusDmgPercent}%</b> bonus damage against enemies of <b>divine</b> or <b>demigod</b> blood, and <b>${this.piercingPercentage}%</b> of that damage goes straight past their <b>Defense</b>.`,
      pt: `Tudo que a linhagem divina tirou de Clay, ele agora cobra de volta com juros. Ele causa <b>${this.bonusDmgPercent}%</b> de dano bônus contra inimigos de sangue <b>divino</b> ou <b>semideus</b>, e <b>${this.piercingPercentage}%</b> desse dano passa direto pela <b>Defesa</b> deles.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, baseDamage }) {
    if (attacker !== owner) return;
    if (!Array.isArray(defender?.species)) return;
    if (!defender.species.some((s) => s === "divinity" || s === "demigod"))
      return;

    const boosted =
      Number(baseDamage ?? damage ?? 0) * (1 + this.bonusDmgPercent / 100);

    return {
      baseDamage: boosted,
      preMitigationDamage: boosted,
      mode: "piercing",
      piercingPercentage: this.piercingPercentage,
    };
  },
};
