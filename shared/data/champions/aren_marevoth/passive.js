import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "deep_transfiguration",
  name: "Deep Transfiguration",

  healPercent: 0.08,
  hpThreshold: 0.5,
  nextAttackBonusFlat: 20,

  description(champion) {
    return `When Marevóth falls below ${this.hpThreshold * 100}% HP, he removes 1 negative status effect from himself and restores ${this.healPercent * 100}% of his Max HP. This can only occur once per turn.

    When a negative status effect is removed this way, Marevóth's next attack lands whole as Absolute Damage, carrying a further ${this.nextAttackBonusFlat} bonus damage on top.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  // The negative effects he sheds are the ones most likely to have pushed him
  // under the threshold, so their ticks have to reach him.
  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onAfterDmgTaking({ owner, actualDmg, context }) {
    if (!(actualDmg > 0) || !owner.alive) return;

    const previousHP = owner.HP + actualDmg;
    const threshold = owner.maxHP * this.hpThreshold;

    // Only triggers when crossing the threshold, not from any damage while below 50%.
    if (previousHP > threshold && owner.HP <= threshold) {
      const lastTriggerTurn =
        owner.runtime?.deepTransfigurationLastTriggerTurn;

      if (lastTriggerTurn === context.currentTurn) return;

      const debuffStatusEffects = owner.getStatusEffects({
        type: "debuff",
      });

      // Only activates if there is a debuff to remove.
      if (!debuffStatusEffects.length) return;

      owner.runtime.deepTransfigurationLastTriggerTurn = context.currentTurn;

      const removedDebuff = debuffStatusEffects[0];

      owner.removeStatusEffect(removedDebuff.key);

      const restored = new HealEvent({
        target: owner,
        amount: owner.maxHP * this.healPercent,
        context,
        source: owner,
      }).execute();

      owner.runtime.deepTransfigurationNextAttackBonus = true;

      return {
        log:
          `<b>[Passive - Deep Transfiguration]</b> ` +
          `${formatChampionName(owner)} crossed the 50% HP threshold, ` +
          `removed ${removedDebuff.name ?? removedDebuff.key}, ` +
          `restored ${restored} HP ` +
          `and empowered his next attack.`,
      };
    }
  },

  onBeforeDmgDealing({ owner, damage, baseDamage }) {
    const state =
      owner.runtime?.deepTransfigurationNextAttackBonus;

    if (!state) return;

    // Consume the effect: only this attack is transfigured.
    owner.runtime.deepTransfigurationNextAttackBonus = false;

    const raw = Number(baseDamage ?? damage ?? 0);

    return {
      mode: "absolute",
      baseDamage: raw,
      preMitigationDamage: raw,
      bonusDamage: this.nextAttackBonusFlat,
    };
  },
};