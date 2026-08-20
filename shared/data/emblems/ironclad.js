export const ironclad = {
  key: "ironclad",
  name: "Emblem of the Ironclad",

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return "Your champions gain 15% damage reduction and are immune to indirect damage.";
  },

  hookScope: {
    onDamageIncoming: "defender",
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
      source: "Emblem of the Ironclad",
      context,
    });
  },

  onDamageIncoming({ defender, damage, context, owner }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!Number.isFinite(Number(damage)) || Number(damage) <= 0) return;
    if ((context?.damageDepth ?? 0) <= 0) return;

    return {
      cancel: true,
      immune: true,
      message: `<b>[Emblem — Ironclad]</b> ${defender.name} is immune to indirect damage!`,
    };
  },
};
