import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";
import { ElementalInteractions } from "../../engine/combat/ElementalInteractions.js";

const burning = {
  key: "burning",
  name: "Burning",
  type: "debuff",
  subtypes: ["dot", "fire"],
  // An attack that deals no damage does not set the target alight, unless the
  // applying skill explicitly waives this.
  requiresDamage: true,
  healingReductionPercent: 35,

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeHealing: "healTarget",
  },

  onBeforeHealing({ amount }) {
    if (amount <= 0) return;

    return { amount: amount * (1 - this.healingReductionPercent / 100) };
  },

  onAfterDmgTaking({ defender, damage, element, context }) {
    if (damage <= 0 || element !== "water") return;

    return ElementalInteractions.onBurningDoused({ target: defender, context });
  },

  onTurnStart({ owner, context }) {
    const multiplier = Number(this.damageMultiplier) || 1;
    const damage = (15 + Math.floor(owner.maxHP * 0.04)) * multiplier;

    const dotContext = { ...context, isDot: true };

    const dmgEvent = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Burn", key: "burning_tick" },
      context: dotContext,
      type: "magical",
      baseDamage: damage,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    });

    const result = dmgEvent.execute();

    if (result?.immune) {
      return {
        log: `${formatChampionName(owner)} is immune to Burn damage!`,
      };
    }

    return {
      log: `${formatChampionName(owner)} takes ${result?.totalDamage ?? damage} Burn damage.`,
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
        healingReductionPercent: this.healingReductionPercent,
        hookScope: this.hookScope,
        onTurnStart: this.onTurnStart,
        onAfterDmgTaking: this.onAfterDmgTaking,
        onBeforeHealing: this.onBeforeHealing,
      },
    });
  },
};

export default burning;