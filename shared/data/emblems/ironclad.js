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
    onChampionAdded: "owner",
    onDamageIncoming: "defender",
  },

  onChampionAdded({ owner, context }) {
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;
    if (!owner.applyDamageReduction) return;

    // Check if already applied to this champion
    if (owner.runtime?._ironCladApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._ironCladApplied = true;

    // Apply buff only to this specific champion
    owner.applyDamageReduction({
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
