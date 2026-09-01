import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const healBlock = {
  key: "healBlock",
  name: "Heal Block",
  type: "debuff",
  subtypes: ["healBlock"],
  requiresDamage: true,

  description:
    "The champion cannot recover HP by any means, lifesteal included.",

  hookScope: {
    onBeforeHealing: "healTarget",
  },

  onBeforeHealing({ healTarget, amount, context }) {
    if (amount <= 0) return;

    context?.registerDialog?.({
      message: `${formatChampionName(healTarget)} has <b>${this.name}</b> and cannot be healed!`,
      sourceId: healTarget.id,
      targetId: healTarget.id,
    });

    return { amount: 0 };
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
        onBeforeHealing: this.onBeforeHealing,
      },
    });
  },
};

export default healBlock;
