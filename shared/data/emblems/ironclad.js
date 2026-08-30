export const ironclad = {
  key: "ironclad",
  name: "Emblem of Impervious Steel",
  piercingResistPercent: 50,

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return `Your champions gain 15% damage reduction and halve the effectiveness of Piercing damage against them.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!champion.applyDamageReduction) return;

    // Check if already applied to this champion
    if (champion.runtime?._ironCladApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._ironCladApplied = true;

    // Apply buff only to this specific champion
    champion.applyDamageReduction({
      amount: 15,
      type: "percent",
      duration: 9999,
      source: "Emblem of Impervious Steel",
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
      log: `<b>[Emblem — Impervious Steel]</b> ${defender.name}'s steel resists the piercing strike, halving its effectiveness!`,
    };
  },
};
