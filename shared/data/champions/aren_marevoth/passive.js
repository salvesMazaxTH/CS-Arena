// shared/champions/aren_marevoth/passive.js

import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "transfiguracao_profunda",
  name: "Transfiguração Profunda",

  healPercent: 0.08,
  hpThreshold: 0.5,
  nextAttackBonusPercent: 0.65,
  nextAttackBonusFlat: 20,

  description(champion) {
    return `Ao cair abaixo de ${this.hpThreshold * 100}% de HP, Marevóth remove 1 debuff negativo de si e recupera ${this.healPercent * 100}% do HP máximo (isso só pode ocorrer uma vez por turno.) Quando um debuff é removido dessa forma, seu próximo ataque converte ${this.nextAttackBonusPercent * 100}% do dano base que causaria em dano absoluto e recebe +${this.nextAttackBonusFlat} de dano absoluto.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, damage, context }) {
    if (damage <= 0) return;

    const previousHP = owner.HP + damage;
    const threshold = owner.maxHP * this.hpThreshold;

    // Só dispara ao CRUZAR o limiar, não em qualquer dano enquanto <50%.
    if (previousHP > threshold && owner.HP <= threshold) {
      const lastTriggerTurn =
        owner.runtime?.transfiguracaoProfundaLastTriggerTurn;

      if (lastTriggerTurn === context.currentTurn) return;

      owner.runtime.transfiguracaoProfundaLastTriggerTurn = context.currentTurn;

      const debuffStatusEffects = owner.getStatusEffects({ type: "debuff" });

      // Só ativa se houver um debuff para remover.
      if (!debuffStatusEffects.length) return;

      const removedDebuff = debuffStatusEffects[0];

      owner.removeStatusEffect(removedDebuff.key);

      const healingAmount = owner.maxHP * this.healPercent;

      owner.heal(healingAmount, context, owner);

      owner.runtime.transfiguracaoProfundaNextAttackBonus = true;

      return {
        log:
          `<b>[Passiva - Transfiguração Profunda]</b> ` +
          `${formatChampionName(owner)} rompeu o limiar de 50% de HP, ` +
          `removeu ${removedDebuff.name ?? removedDebuff.key}, ` +
          `recuperou ${Math.floor(healingAmount)} HP ` +
          `e preparou seu próximo ataque.`,
      };
    }
  },

  onBeforeDmgDealing({ owner, damage, context }) {
    if (owner !== context.attacker) return;

    const state = owner.runtime?.transfiguracaoProfundaNextAttackBonus;

    if (!state) return;

    // Consome o efeito: apenas este ataque é transfigurado.
    owner.runtime.transfiguracaoProfundaNextAttackBonus = false;

    const transformedDamage =
      damage * this.nextAttackBonusPercent + this.nextAttackBonusFlat;

    return {
      damage: transformedDamage,
      mode: "absolute",
    };
  },
};
