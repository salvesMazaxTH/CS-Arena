import { THUNDER_FLAT_BONUS } from "../tony_raiturus/passive.js";

export default {
  key: "sound_and_light_together",
  name: "Sound and Light Together",

  description() {
    return `Nothing about the storm is running ahead of itself any more. Tony Raiturus no longer splits his blows: every strike lands whole and at once, carrying ${THUNDER_FLAT_BONUS} bonus damage, and cannot be evaded.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || defender === owner) return;

    return { damage: Number(damage) + THUNDER_FLAT_BONUS };
  },
};
