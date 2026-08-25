import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { ElementalInteractions } from "../../engine/combat/ElementalInteractions.js";

// Reduces Speed and Attack to 0 and prevents the target from acting for X turns (usually 1)
const frozen = {
  key: "frozen",
  name: "Frozen",
  type: "debuff",
  subtypes: ["hardCC", "ice"],

  // Evolved form of Chilled: replaces it on apply, decays back into it on expiry.
  evolvesFrom: "chilled",
  decaysTo: { key: "chilled", duration: 1 },

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });

    owner.modifyStat({
      statName: "Attack",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });

    return {
      message: `${formatChampionName(owner)} was ${this.name}!`,
    };
  },

  hookScope: {
    onValidateAction: "actionSource",
    onAfterDmgTaking: "defender",
  },

  onValidateAction({ actionSource }) {
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} is Frozen and cannot act!`,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, element, context }) {
    if (damage <= 0) return;

    // A freeze applied this same turn must survive it.
    const currentTurn = context?.currentTurn ?? 0;

    const effect =
      defender.getStatusEffect?.("frozen") ||
      defender.statusEffects?.get?.("frozen");

    if (effect && effect.appliedAtTurn < currentTurn) {
      defender.removeStatusEffect("frozen");

      const reaction = ElementalInteractions.onFrozenBroken({
        target: defender,
        element,
        context,
      });

      return {
        log: `${formatChampionName(defender)} breaks out of the ice!
${reaction.log}`,
      };
    }

    return;
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
        onStatusEffectAdded: this.onStatusEffectAdded,
        onValidateAction: this.onValidateAction,
        onAfterDmgTaking: this.onAfterDmgTaking,
      },
    });
  },
};

export default frozen;