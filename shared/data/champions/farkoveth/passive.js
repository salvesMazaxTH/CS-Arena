import { formatChampionName } from "../../../ui/formatters.js";

export function spendDefense({ user, amount, context }) {
  const { appliedAmount } = user.modifyStat({
    statName: "Defense",
    amount: -amount,
    context,
    isPermanent: true,
    statModifierSrc: user,
  });

  user.runtime.sarkovethDefenseSpentTurn = context.currentTurn;
  return Math.abs(appliedAmount);
}

export default {
  key: "stone_reknits_slowly",
  name: "Stone Reknits Slowly",

  defenseRegen: 20,
  healingReduction: 75,

  description() {
    return `Sarkoveth is not flesh, and what mends flesh barely finds purchase on him: anything that would restore his HP restores ${this.healingReduction}% less. What he does have is time — at the start of a turn, if he spent no Defense on his previous turn, the stone knits back +${this.defenseRegen} Defense, never above the Defense he was carved with.`;
  },

  hookScope: {
    onBeforeHealing: "healTarget",
  },

  onBeforeHealing({ amount }) {
    if (amount <= 0) return;

    return { amount: Math.floor(amount * (1 - this.healingReduction / 100)) };
  },

  onTurnStart({ owner, context }) {
    if (owner.runtime.sarkovethDefenseSpentTurn === context.currentTurn - 1) {
      return;
    }

    const missing = owner.baseDefense - owner.Defense;
    if (missing <= 0) return;

    const { appliedAmount } = owner.modifyStat({
      statName: "Defense",
      amount: Math.min(this.defenseRegen, missing),
      context,
      isPermanent: true,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} knits +${appliedAmount} Defense back into himself.`,
    };
  },
};
