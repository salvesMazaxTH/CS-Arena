import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const concealed = {
  key: "concealed",
  name: "Concealed",
  type: "state",
  subtypes: ["stealth"],

  description:
    "Only the enemy directly opposite can target it. Taking any damage, or acting, ends it.",

  // A single-target attacker who is not directly opposite cannot see it; area
  // and splash damage still reach it.
  hidesFromAttacker(attacker, owner) {
    return attacker.combatSlot !== owner.combatSlot;
  },

  onAfterDmgTaking({ owner, damage, context }) {
    if (!(damage > 0) || !owner.hasStatusEffect(this.key)) return;

    owner.removeStatusEffect(this.key);
    context?.registerDialog?.({
      message: `${formatChampionName(owner)} is dragged back into sight.`,
      sourceId: owner.id,
      targetId: owner.id,
    });
  },

  onActionResolved({ owner, context }) {
    const instance = owner.statusEffects.get(this.key);
    if (!instance || instance.appliedByAction(context)) return;

    owner.removeStatusEffect(this.key);
    context?.registerDialog?.({
      message: `${formatChampionName(owner)} breaks from cover.`,
      sourceId: owner.id,
    });
  },

  createInstance({ owner, duration, context, metadata }) {
    // Break on the wearer's next action unless the caller opts out; the
    // reveal-on-damage rule always applies.
    const breaksOnAction = metadata?.breaksOnAction !== false;

    const hookScope = {
      onAfterDmgTaking: "defender",
    };
    const hooks = {
      name: this.name,
      type: this.type,
      subtypes: this.subtypes,
      description: this.description,
      hookScope,
      onAfterDmgTaking: this.onAfterDmgTaking,
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

export default concealed;
