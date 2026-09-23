import { formatChampionName } from "../../../ui/formatters.js";
import { SpawnProtection } from "../../../engine/combat/spawnProtection.js";

export default {
  key: "weight_of_ages",
  name: "Weight of Ages",
  attackReductionPercent: 17,
  defenseReductionPercent: 13.5,
  maxTriggers: 4,
  description() {
    return {
      en: `Sengoku enters battle with the might of an age long past, but centuries press down on his shoulders and he cannot hold that power for long. At the start of each turn, he loses <b>${this.attackReductionPercent}%</b> of his base Attack and <b>${this.defenseReductionPercent}%</b> of his base Defense, up to <b>${this.maxTriggers}</b> times per battle.`,
      pt: `Sengoku entra em batalha com o vigor de uma era há muito passada, mas os séculos pesam sobre seus ombros e ele não consegue sustentar esse poder por muito tempo. No início de cada turno, ele perde <b>${this.attackReductionPercent}%</b> do seu Ataque base e <b>${this.defenseReductionPercent}%</b> da sua Defesa base, até <b>${this.maxTriggers}</b> vezes por batalha.`,
    };
  },
  onTurnStart({ owner, context }) {
    owner.runtime ??= {};
    owner.runtime.weightOfAgesTriggers ??= 0;

    // The turn-start sweep runs before spawn protection is cleared.
    if (SpawnProtection.isActive(owner)) return;

    if (owner.runtime.weightOfAgesTriggers >= this.maxTriggers) {
      return;
    }

    owner.runtime.weightOfAgesTriggers += 1;

    const attackResult = owner.modifyStat({
      statName: "Attack",
      amount: -this.attackReductionPercent,
      context,
      isPermanent: true,
      isPercent: true,
      statModifierSrc: owner,
    });

    const defenseResult = owner.modifyStat({
      statName: "Defense",
      amount: -this.defenseReductionPercent,
      context,
      isPermanent: true,
      isPercent: true,
      statModifierSrc: owner,
    });

    const attackLoss = Math.abs(attackResult?.appliedAmount ?? 0);
    const defenseLoss = Math.abs(defenseResult?.appliedAmount ?? 0);

    context.registerDialog({
      message: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} grows weary (loses Attack and Defense).`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} se cansa (perde Ataque e Defesa).`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} loses <b>${attackLoss}</b> Attack and <b>${defenseLoss}</b> Defense (${owner.runtime.weightOfAgesTriggers}/${this.maxTriggers}).`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} perde <b>${attackLoss}</b> de Ataque e <b>${defenseLoss}</b> de Defesa (${owner.runtime.weightOfAgesTriggers}/${this.maxTriggers}).`,
      },
    };
  },
};
