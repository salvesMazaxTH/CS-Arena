import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const afflictionWard = {
  key: "afflictionWard",
  name: "Affliction Ward",
  namePt: "Proteção contra Aflição",
  type: "buff",
  subtypes: ["immunity"],

  hookScope: {
    onStatusEffectIncoming: "target",
    onHookEffectIncoming: "target",
  },

  turnAway(target, effectName, effectNamePt = effectName) {
    if (this.spent) return;

    this.spent = true;
    target.removeStatusEffect(this.key);

    return {
      cancel: true,
      message: {
        en: `${formatChampionName(target)} has <b>${this.name}</b>: <b>${effectName}</b> never takes hold.`,
        pt: `${formatChampionName(target)} tem <b>${this.namePt}</b>: <b>${effectNamePt}</b> não chega a se firmar.`,
      },
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;
    return this.turnAway(target, statusEffect.name, statusEffect.namePt ?? statusEffect.name);
  },

  onHookEffectIncoming({ target, hookEffect }) {
    if (hookEffect.type !== "debuff") return;
    return this.turnAway(target, hookEffect.name ?? hookEffect.key);
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
        turnAway: this.turnAway,
        onStatusEffectIncoming: this.onStatusEffectIncoming,
        onHookEffectIncoming: this.onHookEffectIncoming,
      },
    });
  },
};

export default afflictionWard;
