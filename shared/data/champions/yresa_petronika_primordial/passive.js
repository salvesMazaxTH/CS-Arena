import soilboundOath from "../yresa_petronika/passive.js";

export default {
  key: "unyielding_bedrock",
  name: "Unyielding Bedrock",

  hpThresholdPercent: 50,
  dmgReductionPercent: 25,
  refreshDurationTurns: 2,
  dmgReductionSrc: "yresa_petronika_primordial_unyielding_bedrock",

  description() {
    return {
      en: `Once her true form falls below <b>${this.hpThresholdPercent}%</b> <b>HP</b>, less of her is left to break: she takes <b>${this.dmgReductionPercent}%</b> less damage from every source (except <b>Absolute Damage</b>) for as long as she stays below that line.`,
      pt: `Quando sua forma verdadeira cai abaixo de <b>${this.hpThresholdPercent}%</b> de <b>HP</b>, sobra menos dela para quebrar: ela sofre <b>${this.dmgReductionPercent}%</b> menos dano de qualquer fonte (exceto <b>Dano Absoluto</b>) enquanto permanecer abaixo dessa linha.`,
    };
  },

  hookScope: {
    onAfterHealing: "healTarget",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onTurnStart({ owner, context }) {
    this._refresh({ owner, context });
  },

  // Unscoped: a Stoneward left standing through the transform can still fall.
  onAfterDmgTaking({ defender, owner, context }) {
    if (defender.id === owner.id) {
      this._refresh({ owner, context });
      return;
    }

    if (!defender.alive && owner.runtime.sentinelIds?.includes(defender.id)) {
      soilboundOath.livingSentinels({ owner, context });
    }
  },

  onAfterHealing({ owner, context }) {
    this._refresh({ owner, context });
  },

  _refresh({ owner, context }) {
    owner.damageReductionModifiers = (
      owner.damageReductionModifiers ?? []
    ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);

    if (owner.HP > owner.maxHP * (this.hpThresholdPercent / 100)) return;

    // Capped at the revert, so it expires with the form instead of following her back.
    const revertAtTurn = owner.runtime.transformation?.revertAtTurn;
    const duration = revertAtTurn
      ? Math.min(this.refreshDurationTurns, revertAtTurn - context.currentTurn)
      : this.refreshDurationTurns;

    owner.applyDamageReduction({
      amount: this.dmgReductionPercent,
      duration,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });
  },
};
