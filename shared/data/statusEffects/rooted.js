import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const rooted = {
  key: "rooted",
  name: "Rooted",
  namePt: "Enraizado",
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
      message: {
        en: `${formatChampionName(actionSource)} is Rooted and cannot use the contact ability "${skillName}"!`,
        pt: `${formatChampionName(actionSource)} está Enraizado e não pode usar a habilidade de contato "${skillName}"!`,
      },
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

export default rooted;