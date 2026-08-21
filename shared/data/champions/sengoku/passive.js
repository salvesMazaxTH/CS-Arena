import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "weight_of_ages",
  name: "Weight of Ages",
  attackReductionPercent: 17,
  defenseReductionPercent: 13.5,
  maxTriggers: 4,
  description() {
    return `Sengoku enters battle with the might of an age long past, but centuries press down on his shoulders and he cannot hold that power for long. At the start of each turn, he loses ${this.attackReductionPercent}% of his base Attack and ${this.defenseReductionPercent}% of his base Defense, up to ${this.maxTriggers} times per battle.`;
  },
  onTurnStart({ owner, context }) {
    owner.runtime ??= {};
    owner.runtime.weightOfAgesTriggers ??= 0;

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
      message: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} grows weary (loses Attack and Defense).`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} loses ${attackLoss} Attack and ${defenseLoss} Defense (${owner.runtime.weightOfAgesTriggers}/${this.maxTriggers}).`,
    };
  },
};
