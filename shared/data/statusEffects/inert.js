import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const inert = {
  key: "inert",
  name: "Inert",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource }) {
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} is Inert and cannot act!`,
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
        hookScope: this.hookScope,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default inert;