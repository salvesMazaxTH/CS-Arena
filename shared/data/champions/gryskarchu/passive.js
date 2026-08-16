import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "fountain_of_life",
  name: "Fountain of Life",

  selfHeal: 15,
  hpThreshold: 50,
  defBonus: 10,

  description() {
    return `Whenever Gryskarchu restores HP to an ally, he restores ${this.selfHeal} HP himself. Any excess HP restored this way is converted into permanent Max HP. If the ally was below ${this.hpThreshold}% HP, Gryskarchu gains +${this.defBonus} Defense.`;
  },

  hookScope: {
    onAfterHealing: "healSrc",
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (healTarget.team !== owner.team) return;
    if (healSrc.id === owner?.id) return;
    if (healTarget.id === owner.id) return;

    const selfHealAmount = amount;

    if (selfHealAmount <= 0) return;

    const before = owner.HP;

    // Restore HP normally.
    const applied = owner.heal(selfHealAmount, context);

    if (applied <= 0) return;

    // Calculate actual overheal.
    const potentialTotal = before + selfHealAmount;
    const overheal = Math.max(
      0,
      potentialTotal - owner.maxHP,
    );

    let log = `[PASSIVE — Fountain of Life] ${formatChampionName(
      owner,
    )} restored ${applied} HP.`;

    // Convert overheal into permanent Max HP.
    if (overheal > 0) {
      owner.modifyHP(overheal, {
        context: {
          ...context,
          source: "passive-fountain-of-life-overheal",
        },
        affectMax: true,
        isPermanent: true,
      });
    }

    if (
      healTarget.HP <
      healTarget.maxHP * (this.hpThreshold / 100)
    ) {
      owner.modifyStat({
        statName: "Defense",
        amount: this.defBonus,
        context: {
          ...context,
          source: "passive-fountain-of-life",
        },
        isPermanent: true,
      });

      log += ` ${formatChampionName(
        healTarget,
      )} was below ${this.hpThreshold}% HP, so ${formatChampionName(
        owner,
      )} gained +${this.defBonus} Defense!`;
    }

    return { log };
  },
};