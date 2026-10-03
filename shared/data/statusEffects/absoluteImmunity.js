import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const absoluteImmunity = {
  key: "absoluteImmunity",
  name: "Absolute Immunity",
  namePt: "Imunidade Absoluta",
  type: "buff",
  subtypes: ["immunity"],

  hookScope: {
    onDamageIncoming: "defender",
    onStatusEffectIncoming: "target",
    onHookEffectIncoming: "target",
  },

  onDamageIncoming({ defender }) {
    return {
      cancel: true,
      immune: true,
      message: {
        en: `${formatChampionName(defender)} has <b>${this.name}</b> and is immune to damage!`,
        pt: `${formatChampionName(defender)} tem <b>${this.namePt}</b> e é imune a dano!`,
      },
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: this.negativeEffectMessage(target),
    };
  },

  onHookEffectIncoming({ target, hookEffect }) {
    if (hookEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: this.negativeEffectMessage(target),
    };
  },

  negativeEffectMessage(target) {
    return {
      en: `${formatChampionName(target)} has <b>${this.name}</b> and is immune to negative effects!`,
      pt: `${formatChampionName(target)} tem <b>${this.namePt}</b> e é imune a efeitos negativos!`,
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
        namePt: this.namePt,
        type: this.type,
        subtypes: this.subtypes,
        hookScope: this.hookScope,
        onDamageIncoming: this.onDamageIncoming,
        onStatusEffectIncoming: this.onStatusEffectIncoming,
        onHookEffectIncoming: this.onHookEffectIncoming,
        negativeEffectMessage: this.negativeEffectMessage,
      },
    });
  },
};

export default absoluteImmunity;
