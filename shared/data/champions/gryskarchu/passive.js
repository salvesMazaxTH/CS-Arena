import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "fountain_of_life",
  name: "Fountain of Life",

  selfHeal: 15,
  hpThreshold: 50,
  defBonus: 10,

  description() {
    return `Life given never leaves Gryskarchu. Whenever he restores HP to an ally, the same current runs back through him and he restores ${this.selfHeal} HP himself; anything the wound cannot hold spills over into permanent Max HP.

    If the ally was below ${this.hpThreshold}% HP, the earth braces him in return and he gains +${this.defBonus} permanent Defense.`;
  },

  hookScope: {
    onAfterHealing: "healSrc",
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (healTarget.team !== owner.team) return;
    if (healTarget.id === owner.id) return;

    const selfHealAmount = this.selfHeal;

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

    // The threshold reads the ally's HP before the heal landed, as the
    // passive describes; `amount` is what was actually applied.
    const healTargetHPBefore = healTarget.HP - amount;

    if (
      healTargetHPBefore <
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