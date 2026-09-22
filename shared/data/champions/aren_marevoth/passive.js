import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "deep_transfiguration",
  name: "Deep Transfiguration",

  healPercent: 0.08,
  hpThreshold: 0.5,
  nextAttackBonusFlat: 20,

  description(champion) {
    return {
      en: `When Marevóth falls below <b>${this.hpThreshold * 100}%</b> <b>HP</b>, he removes <b>1</b> negative status effect from himself and restores <b>${this.healPercent * 100}%</b> of his <b>Max HP</b>. This can only occur once per turn.

    When a negative status effect is removed this way, Marevóth's next attack lands whole as <b>Absolute Damage</b>, carrying a further <b>${this.nextAttackBonusFlat}</b> bonus damage on top.`,
      pt: `Quando Marevóth cai abaixo de <b>${this.hpThreshold * 100}%</b> de <b>HP</b>, ele remove <b>1</b> efeito de status negativo de si mesmo e restaura <b>${this.healPercent * 100}%</b> de seu <b>HP Máximo</b>. Isso só pode ocorrer uma vez por turno.

    Quando um efeito de status negativo é removido dessa forma, o próximo ataque de Marevóth acerta inteiro como <b>Dano Absoluto</b>, carregando ainda um bônus de <b>${this.nextAttackBonusFlat}</b> de dano.`,
    };
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