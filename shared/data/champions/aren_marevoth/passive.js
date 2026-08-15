// shared/champions/aren_marevoth/passive.js

import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "deep_transfiguration",
  name: "Deep Transfiguration",

  healPercent: 0.08,
  hpThreshold: 0.5,
  nextAttackBonusPercent: 0.65,
  nextAttackBonusFlat: 20,

  description(champion) {
    return `When Marevóth falls below ${this.hpThreshold * 100}% HP, he removes 1 negative debuff from himself and restores ${this.healPercent * 100}% of his Max HP. This can only occur once per turn.

    When a debuff is removed this way, Marevóth's next attack converts ${this.nextAttackBonusPercent * 100}% of its base damage into Absolute Damage and gains +${this.nextAttackBonusFlat} Absolute Damage.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, damage, context }) {
    if (damage <= 0) return;

    const previousHP = owner.HP + damage;
    const threshold = owner.maxHP * this.hpThreshold;

    // Only triggers when crossing the threshold, not from any damage while below 50%.
    if (previousHP > threshold && owner.HP <= threshold) {
      const lastTriggerTurn =
        owner.runtime?.deepTransfigurationLastTriggerTurn;

      if (lastTriggerTurn === context.currentTurn) return;

      owner.runtime.deepTransfigurationLastTriggerTurn =
        context.currentTurn;

      const debuffStatusEffects = owner.getStatusEffects({
        type: "debuff",
      });

      // Only activates if there is a debuff to remove.
      if (!debuffStatusEffects.length) return;

      const removedDebuff = debuffStatusEffects[0];

      owner.removeStatusEffect(removedDebuff.key);

      const healingAmount = owner.maxHP * this.healPercent;

      owner.heal(healingAmount, context, owner);

      owner.runtime.deepTransfigurationNextAttackBonus = true;

      return {
        log:
          `<b>[Passive - Deep Transfiguration]</b> ` +
          `${formatChampionName(owner)} crossed the 50% HP threshold, ` +
          `removed ${removedDebuff.name ?? removedDebuff.key}, ` +
          `restored ${Math.floor(healingAmount)} HP ` +
          `and empowered his next attack.`,
      };
    }
  },

  onBeforeDmgDealing({ owner, damage, context }) {
    if (owner !== context.attacker) return;

    const state =
      owner.runtime?.deepTransfigurationNextAttackBonus;

    if (!state) return;

    // Consume the effect: only this attack is transfigured.
    owner.runtime.deepTransfigurationNextAttackBonus = false;

    const transformedDamage =
      damage * this.nextAttackBonusPercent +
      this.nextAttackBonusFlat;

    return {
      damage: transformedDamage,
      mode: "absolute",
    };
  },
};