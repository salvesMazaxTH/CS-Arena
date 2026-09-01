import { formatChampionName } from "../../../ui/formatters.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";

export default {
  key: "absolute_cold",
  name: "Absolute Cold",
  passiveDamage: 45,
  lowLifeThresholdRatio: 0.3,
  forcedCritBonus: 55,

  hits: [
    {
      id: "closing_ice",
      label: "Absolute Cold (Passive)",
      type: "magical",
      contact: false,
      damageMode: "absolute",
    },
  ],

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectApplied: undefined,
  },

  onBeforeDmgDealing({ attacker, owner, defender, crit }) {
    if (attacker !== owner) return;
    if (!defender?.maxHP) return;

    const lowLifeThreshold = Math.ceil(
      defender.maxHP * this.lowLifeThresholdRatio,
    );
    const isLowHP = defender.HP <= lowLifeThreshold;

    if (!isLowHP) return;

    return {
      crit: {
        ...(crit || {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus: Number(crit?.bonus || this.forcedCritBonus),
      },
    };
  },

  description() {
    return `Bruno waits for the moment the cold has already done the work. Against targets at or below ${this.lowLifeThresholdRatio * 100}% of their Max HP, his attacks are always a critical hit.

    And whenever an enemy champion becomes Frozen, the ice closes on them at his word for ${this.passiveDamage} Absolute Damage.`;
  },

  onStatusEffectApplied({ target, statusEffect, context, owner }) {
    if (statusEffect.key !== "frozen") return;
    if (target.team === owner.team) return;
    if (!owner.alive) return;
    if (!context?.allChampions) return;

    context.registerDialog?.({
      message: `${formatChampionName(owner)} activated <b>Absolute Cold</b> and dealt ${this.passiveDamage} Absolute Damage to ${formatChampionName(target)}!`,
      sourceId: owner.id,
      targetId: target.id,
    });

    SkillHits.run(this, "closing_ice", {
      user: owner,
      target,
      baseDamage: this.passiveDamage,
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
    });
  },
};