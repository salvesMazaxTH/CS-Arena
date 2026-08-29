import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const snared = {
  key: "snared",
  name: "Snared",
  type: "debuff",
  subtypes: ["softCC"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource, skill }) {
    if (!skill?.contact) return;

    const skillName = skill?.name || "ability";

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} is Snared and cannot use the contact ability "${skillName}"!`,
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

export default snared;