import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "fountain_of_life",
  name: "Fountain of Life",

  selfHeal: 15,
  hpThreshold: 50,
  defBonus: 10,

  description() {
    return {
      en: `Life given never leaves Gryskarchu. Whenever he restores <b>HP</b> to an ally, the same current runs back through him and he restores <b>${this.selfHeal}</b> HP himself; anything the wound cannot hold spills over into permanent <b>Max HP</b>.

      If the ally was below <b>${this.hpThreshold}%</b> HP, the current runs back stronger and he gains <b>+${this.defBonus}</b> permanent Defense.`,
      pt: `Vida cedida nunca deixa Gryskarchu. Sempre que ele restaura <b>HP</b> a um aliado, a mesma corrente volta através dele e restaura <b>${this.selfHeal}</b> de HP para si mesmo; o que a ferida não consegue conter transborda em <b>HP Máximo</b> permanente.

      Se o aliado estava abaixo de <b>${this.hpThreshold}%</b> de HP, a corrente volta mais forte e ele ganha <b>+${this.defBonus}</b> de Defesa permanente.`,
    };
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
    const applied = new HealEvent({
      target: owner,
      amount: selfHealAmount,
      context,
    }).execute();

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