import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const absoluteImmunity = {
  key: "absoluteImmunity",
  name: "Absolute Immunity",
  type: "buff",
  subtypes: ["immunity"],

  hookScope: {
    onDamageIncoming: "defender",
    onStatusEffectIncoming: "target",
  },

  onDamageIncoming({ defender }) {
    return {
      cancel: true,
      immune: true,
      message: `${formatChampionName(defender)} has <b>${this.name}</b> and is immune to damage!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} has <b>${this.name}</b> and is immune to negative effects!`,
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
        onDamageIncoming: this.onDamageIncoming,
        onStatusEffectIncoming: this.onStatusEffectIncoming,
      },
    });
  },
};

export default absoluteImmunity;
