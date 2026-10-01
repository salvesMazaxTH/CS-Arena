export const impervious_steel = {
  key: "impervious_steel",
  name: "Emblem of Impervious Steel",
  dmgReductionPercent: 15,
  piercingResistPercent: 50,

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain ${this.dmgReductionPercent}% damage reduction (except Absolute Damage) and Piercing damage against them loses ${this.piercingResistPercent}% of its effectiveness.`,
      pt: `Seus campeões ganham ${this.dmgReductionPercent}% de redução de dano (exceto Dano Absoluto) e o dano Perfurante contra eles perde ${this.piercingResistPercent}% de sua eficácia.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    champion.applyDamageReduction({
      amount: this.dmgReductionPercent,
      type: "percent",
      duration: 9999,
      source: this.name,
      context,
    });
  },

  onBeforeDmgTaking({ defender, owner, mode, piercingPercentage }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (mode !== "piercing") return;

    const resistedPiercing =
      Number(piercingPercentage || 0) * (1 - this.piercingResistPercent / 100);

    return {
      piercingPercentage: resistedPiercing,
      log: `<b>[Emblem — Impervious Steel]</b> ${defender.name}'s steel resists the piercing strike, cutting its effectiveness by ${this.piercingResistPercent}%!`,
    };
  },
};
