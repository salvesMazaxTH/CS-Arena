export default {
  key: "unyielding_bedrock",
  name: "Unyielding Bedrock",

  hpThresholdPercent: 50,
  dmgReductionPercent: 25,
  refreshDurationTurns: 2,
  dmgReductionSrc: "yresa_petronika_primordial_unyielding_bedrock",

  description() {
    return {
      en: `Once her true form falls below <b>${this.hpThresholdPercent}%</b> HP, less of her is left to break: she takes <b>${this.dmgReductionPercent}%</b> less damage from every source (except Absolute Damage) for as long as she stays below that line.`,
      pt: `Quando sua forma verdadeira cai abaixo de <b>${this.hpThresholdPercent}%</b> de HP, sobra menos dela para quebrar: ela sofre <b>${this.dmgReductionPercent}%</b> menos dano de qualquer fonte (exceto Dano Absoluto) enquanto permanecer abaixo dessa linha.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onTurnStart({ owner, context }) {
    this._refresh({ owner, context });
  },

  onAfterDmgTaking({ owner, context }) {
    this._refresh({ owner, context });
  },

  _refresh({ owner, context }) {
    owner.damageReductionModifiers = (
      owner.damageReductionModifiers ?? []
    ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);

    if (owner.HP > owner.maxHP * (this.hpThresholdPercent / 100)) return;

    owner.applyDamageReduction({
      amount: this.dmgReductionPercent,
      duration: this.refreshDurationTurns,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });
  },
};
