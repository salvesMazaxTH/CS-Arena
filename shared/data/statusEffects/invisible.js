import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const invisible = {
  key: "invisible",
  name: "Invisible",
  type: "buff",
  subtypes: ["stealth"],

  description: "Cannot be targeted by enemies until its next action.",

  hookScope: {
    onValidateAction: "target",
  },

  // 🔒 Prevents the target from being targeted
  onValidateAction({ actionSource, owner, context }) {
    if (!actionSource || actionSource.id === owner.id) return;

    const message = `${formatChampionName(actionSource)} cannot find ${formatChampionName(owner)}.`;

    context?.registerDialog?.({
      message,
      sourceId: actionSource.id,
      targetId: owner.id,
    });

    return {
      deny: true,
      message,
    };
  },

  createInstance({ owner, duration, context, metadata }) {
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        description: this.description,
        hookScope: this.hookScope,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default invisible;