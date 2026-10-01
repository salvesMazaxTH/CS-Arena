// shared/data/emblems/earthen_ward.js

import { championHasAffinity } from "../championTraits.js";

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
    return {
      en: "Your Earth champions are immune to indirect damage.",
      pt: "Seus campeões de Terra são imunes a dano indireto.",
    };
  },

  onDamageIncoming({ defender, damage, context, owner }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!championHasAffinity(defender, "earth")) return;
    if (!Number.isFinite(Number(damage)) || Number(damage) <= 0) return;
    if ((context?.damageDepth ?? 0) <= 0) return;

    return {
      cancel: true,
      immune: true,
      message: `<b>[Emblem — Earthen Ward]</b> ${defender.name} is immune to indirect damage!`,
    };
  },
};
