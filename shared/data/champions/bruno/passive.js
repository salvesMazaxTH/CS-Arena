import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "absolute_cold",
  name: "Absolute Cold",
  passiveDamage: 45,
  lowLifeThresholdRatio: 0.3,
  forcedCritBonus: 55,

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: undefined,
  },

  onBeforeDmgDealing({ attacker, owner, defender, crit, damage }) {
    if (attacker !== owner) return;
    if (!defender?.maxHP) return;

    const lowLifeThreshold = Math.ceil(
      defender.maxHP * this.lowLifeThresholdRatio,
    );
    const isLowHP = defender.HP <= lowLifeThreshold;

    if (!isLowHP) return;

    const bonus = Number(crit?.bonus || this.forcedCritBonus);
    const critBonusFactor = bonus / 100;

    return {
      crit: {
        ...(crit || {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus,
        critBonusFactor,
        critExtra: damage * critBonusFactor,
      },
    };
  },

  description() {
    return `Bruno waits for the moment the cold has already done the work. Against targets at or below ${this.lowLifeThresholdRatio * 100}% of their Max HP, his attacks are always a critical hit.

    And whenever an enemy champion becomes Frozen, the ice closes on them at his word for ${this.passiveDamage} Absolute Damage.`;
  },

  onStatusEffectIncoming({ target, statusEffect, context, owner }) {
    if (statusEffect.key !== "frozen") return;
    if (target.team === owner.team) return;
    if (!owner.alive) return;
    if (target.hasStatusEffect?.("frozen")) return;
    if (!context?.allChampions) return;

    context.registerDialog?.({
      message: `${formatChampionName(owner)} activated <b>Absolute Cold</b> and dealt ${this.passiveDamage} Absolute Damage to ${formatChampionName(target)}!`,
      sourceId: owner.id,
      targetId: target.id,
    });

    new DamageEvent({
      mode: DamageEvent.Modes.ABSOLUTE,
      baseDamage: this.passiveDamage,
      attacker: owner,
      defender: target,
      skill: {
        key: "absolute_cold_passive",
        name: "Absolute Cold (Passive)",
        contact: false,
      },
      type: "magical",
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      allChampions: context.allChampions,
    }).execute();
  },
};