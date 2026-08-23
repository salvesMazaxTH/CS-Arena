// shared/data/emblems/earthen_ward.js

function hasEarthAffinity(champion) {
  const affinities = Array.isArray(champion?.elementalAffinities)
    ? champion.elementalAffinities
    : typeof champion?.elementalAffinities === "string"
      ? [champion.elementalAffinities]
      : [];
  return affinities.some(
    (affinity) => String(affinity).trim().toLowerCase() === "earth",
  );
}

export const earthenWard = {
  key: "earthen_ward",
  name: "Emblem of the Earthen Ward",

  // A far more rigorous Earth requirement than Earthshaker's: denying ALL
  // indirect damage is powerful enough that it stays scoped to the Earth
  // champions themselves rather than granted to the whole team.
  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 5,
    },
  },

  description() {
    return "Your Earth champions are immune to indirect damage.";
  },

  hookScope: {
    onDamageIncoming: "defender",
  },

  onDamageIncoming({ defender, damage, context, owner }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!hasEarthAffinity(defender)) return;
    if (!Number.isFinite(Number(damage)) || Number(damage) <= 0) return;
    if ((context?.damageDepth ?? 0) <= 0) return;

    return {
      cancel: true,
      immune: true,
      message: `<b>[Emblem — Earthen Ward]</b> ${defender.name} is immune to indirect damage!`,
    };
  },
};
