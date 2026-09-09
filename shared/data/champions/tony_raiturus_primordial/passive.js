import {
  THUNDER_FLAT_BONUS,
  detonateThunder,
} from "../tony_raiturus/passive.js";

export default {
  key: "sound_and_light_together",
  name: "Sound and Light Together",

  description() {
    return `Nothing about the storm is running ahead of itself any more. Tony Raiturus no longer splits his blows: every strike lands whole and at once, carrying ${THUNDER_FLAT_BONUS} bonus damage, and cannot be evaded. The moment he unfolds, every thunder still owed to an enemy arrives on the spot.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  // Runtime survives the revert, so the arrival is keyed to this transformation.
  onTurnStart({ owner, context }) {
    const sequence = owner.runtime.transformation?.sequence ?? 0;
    if (owner.runtime.raiturusSyncSequence === sequence) return;
    owner.runtime.raiturusSyncSequence = sequence;

    return detonateThunder(owner, context);
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || defender === owner) return;

    return { damage: Number(damage) + THUNDER_FLAT_BONUS };
  },
};
