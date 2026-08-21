// shared/data/champions/avarion/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import {
  AVARIK_NAME,
  EDICT_DAMAGE,
  EDICT_ATTACK_THRESHOLD,
  isEdictInForce,
  isHollow,
  isIndirectDamage,
} from "../edict.js";

export default {
  key: "edict_of_hollow_might",
  name: "Edict of Hollow Might",

  threshold: EDICT_ATTACK_THRESHOLD,
  edictDamage: EDICT_DAMAGE,

  description() {
    return `Avarion lifts his crystal staff, reads the field like a ledger and decrees what a hand is worth: might too poor to reach ${this.threshold} Attack is too poor to be charged for anything.

    Every champion on the field whose current Attack is below ${this.threshold} deals only ${this.edictDamage} damage per instance of damage, and Avarion answers to his own Edict the moment his Attack falls that low.

    What never passes through the Edict's hands is untouched by it: damage over time, damage that echoes from another source, and Absolute Damage all land in full.

    The Edict falls silent while his younger brother ${AVARIK_NAME} stands on the field, on either side.`;
  },

  // No hookScope: the Edict is a law over the whole field, not a reaction to
  // something happening to Avarion, so it has to be consulted on every instance
  // of damage rather than only on the ones he deals or takes.
  //
  // `onBeforeDmgTaking` is the last hook phase before the damage is applied,
  // which makes it the authoritative place to clamp — and the pipeline skips it
  // entirely on Absolute Damage and on DoT/nested damage, which is exactly the
  // set of damage the Edict does not reach.
  onBeforeDmgTaking({ owner, attacker, damage, context }) {
    if (!(damage > this.edictDamage)) return;

    if (isIndirectDamage(context)) return;

    if (!isEdictInForce(owner, context, AVARIK_NAME)) return;

    if (!isHollow(attacker, "Attack", this.threshold)) return;

    return {
      damage: this.edictDamage,
      log:
        `<b>[Passive — ${this.name}]</b> ` +
        `${formatChampionName(attacker)} wields less than ${this.threshold} Attack ` +
        `and is Hollow under Avarion's Edict, dealing only ${this.edictDamage} damage.`,
    };
  },
};
