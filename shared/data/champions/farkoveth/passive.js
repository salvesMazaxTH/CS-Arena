import { formatChampionName } from "../../../ui/formatters.js";

export function spendDefense({ user, amount, context }) {
  const { appliedAmount } = user.modifyStat({
    statName: "Defense",
    amount: -amount,
    context,
    isPermanent: true,
    statModifierSrc: user,
  });

  user.runtime.farkovethDefenseSpentTurn = context.currentTurn;
  return Math.abs(appliedAmount);
}

export default {
  key: "stone_reknits_slowly",
  name: "Stone Reknits Slowly",

  defenseRegen: 20,
  healingReduction: 75,

  description() {
    return {
      en: `Farkoveth is not flesh, and what mends flesh barely finds purchase on him: anything that would restore his <b>HP</b> restores <b>${this.healingReduction}%</b> less. What he does have is time — at the start of a turn, if he spent no <b>Defense</b> on his previous turn, the stone knits back <b>+${this.defenseRegen}</b> Defense, never above the Defense he was carved with.`,
      pt: `Farkoveth não é carne, e o que cura carne mal encontra onde se firmar nele: qualquer coisa que restauraria seu <b>HP</b> restaura <b>${this.healingReduction}%</b> a menos. O que ele tem é tempo — no início de um turno, se não gastou <b>Defesa</b> no turno anterior, a pedra se reconstitui em <b>+${this.defenseRegen}</b> de Defesa, nunca acima da Defesa com que foi esculpido.`,
    };
  },

  hookScope: {
    onBeforeHealing: "healTarget",
  },

  onBeforeHealing({ amount }) {
    if (amount <= 0) return;

    return { amount: Math.floor(amount * (1 - this.healingReduction / 100)) };
  },

  onTurnStart({ owner, context }) {
    if (owner.runtime.farkovethDefenseSpentTurn === context.currentTurn - 1) {
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
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} knits +${appliedAmount} Defense back into himself.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} tece +${appliedAmount} de Defesa de volta em si mesmo.`,
      },
    };
  },
};
