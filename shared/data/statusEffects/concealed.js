import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const concealed = {
  key: "concealed",
  name: "Concealed",
  type: "state",
  subtypes: ["stealth"],

  description:
    "Only the enemy directly opposite can land a hit. Taking any damage, or acting, ends it.",

  onDamageIncoming({ attacker, defender, context }) {
    if (context?.isDot || !attacker || attacker.id === defender.id) return;

    const facing = context?.getChampionAtSlot?.(
      defender.team === 1 ? 2 : 1,
      defender.combatSlot,
    );
    if (facing?.id === attacker.id) return;

    return {
      cancel: true,
      message: `${formatChampionName(attacker)} strikes at ${formatChampionName(defender)} and cuts only air.`,
    };
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
    if (!instance || instance.appliedContext === context) return;

    owner.removeStatusEffect(this.key);
    context?.registerDialog?.({
      message: `${formatChampionName(owner)} breaks from cover.`,
      sourceId: owner.id,
    });
  },

  createInstance({ owner, duration, context, metadata }) {
    // Break on the wearer's next action unless the caller opts out; the
    // reveal-on-damage and facing-slot rules always apply.
    const breaksOnAction = metadata?.breaksOnAction !== false;

    const hookScope = {
      onDamageIncoming: "defender",
      onAfterDmgTaking: "defender",
    };
    const hooks = {
      name: this.name,
      type: this.type,
      subtypes: this.subtypes,
      description: this.description,
      hookScope,
      onDamageIncoming: this.onDamageIncoming,
      onAfterDmgTaking: this.onAfterDmgTaking,
    };

    if (breaksOnAction) {
      hookScope.onActionResolved = "actionSource";
      hooks.onActionResolved = this.onActionResolved;
    }

    const instance = new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks,
    });

    // Lets onActionResolved skip the very action that applied this effect.
    instance.appliedContext = context;
    return instance;
  },
};

export default concealed;
