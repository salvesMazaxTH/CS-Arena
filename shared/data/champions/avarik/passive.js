// shared/data/champions/avarik/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import {
  AVARION_NAME,
  EDICT_DAMAGE,
  EDICT_HP_THRESHOLD,
  isEdictInForce,
  isHollow,
  isIndirectDamage,
} from "../pairs/edict.js";

export default {
  key: "edict_of_hollow_flesh",
  name: "Edict of Hollow Flesh",

  threshold: EDICT_HP_THRESHOLD,
  edictDamage: EDICT_DAMAGE,

  description() {
    return `Avarik drives his stone-scaled fist into the ground and decrees what a body is worth: flesh too thin to hold ${this.threshold} HP is too thin to wound anything.

    Every champion on the field whose current HP is below ${this.threshold} deals only ${this.edictDamage} damage per instance of damage, and Avarik answers to his own Edict the moment his HP falls that low.

    What never passes through the Edict's hands is untouched by it: damage over time, damage that echoes from another source, and Absolute Damage all land in full.

    The Edict falls silent while his elder brother ${AVARION_NAME} stands on the field, on either side.`;
  },

  // No hookScope: the Edict is a law over the whole field, not a reaction to
  // something happening to Avarik, so it has to be consulted on every instance
  // of damage rather than only on the ones he deals or takes.
  //
  // `onBeforeDmgTaking` is the last hook phase before the damage is applied,
  // which makes it the authoritative place to clamp — and the pipeline skips it
  // entirely on Absolute Damage and on DoT/nested damage, which is exactly the
  // set of damage the Edict does not reach.
  onBeforeDmgTaking({ owner, attacker, damage, context }) {
    if (!(damage > this.edictDamage)) return;

    if (isIndirectDamage(context)) return;

    if (!isEdictInForce(owner, context, AVARION_NAME)) return;

    if (!isHollow(attacker, "HP", this.threshold)) return;

    return {
      // A ceiling, not a damage value: it must not scale with the hit.
      damageCap: this.edictDamage,
      log:
        `<b>[Passive — ${this.name}]</b> ` +
        `${formatChampionName(attacker)} holds less than ${this.threshold} HP ` +
        `and is Hollow under Avarik's Edict, dealing only ${this.edictDamage} damage.`,
    };
  },
};
