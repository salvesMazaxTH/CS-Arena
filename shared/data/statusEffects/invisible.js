import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const invisible = {
  key: "invisible",
  name: "Invisible",
  type: "buff",
  subtypes: ["stealth"],

  description: "Cannot be targeted by enemies until its next action.",

  hidesFromAttacker() {
    return true;
  },

  onActionResolved({ owner, context }) {
    const instance = owner.statusEffects.get(this.key);
    if (!instance || instance.appliedByAction(context)) return;

    owner.removeStatusEffect(this.key);
    context?.registerDialog?.({
      message: `${formatChampionName(owner)} slips back into view.`,
      sourceId: owner.id,
    });
  },

  createInstance({ owner, duration, context, metadata }) {
    // Break on the wearer's next action unless the caller opts out, in which
    // case it just runs out its duration and can be acted through.
    const breaksOnAction = metadata?.breaksOnAction !== false;

    const hookScope = {};
    const hooks = {
      name: this.name,
      type: this.type,
      subtypes: this.subtypes,
      description: this.description,
      hookScope,
    };

    if (breaksOnAction) {
      hookScope.onActionResolved = "actionSource";
      hooks.onActionResolved = this.onActionResolved;
    }

    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks,
    });
  },
};

export default invisible;
