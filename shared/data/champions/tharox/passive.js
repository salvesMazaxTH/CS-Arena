import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "Massa Inamolgável",
  stacksNeeded: 2,
  defBonus: 20,
  healingPerMaxHP: 0.025,
  defensePerHealingStep: 75,
  shieldPercentage: 0.075,
  description() {
    return `Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a ${this.stacksNeeded}, consome ambos e ganha +${this.defBonus} de Defesa permanente. Além disso, cura em ${this.healingPerMaxHP * 100}% do HP máximo para cada ${this.defensePerHealingStep} de Defesa que possui e recebe um escudo equivalente a ${this.shieldPercentage * 100}% do HP máximo.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    owner.runtime.tharoxInerciaStacks =
      (owner.runtime.tharoxInerciaStacks || 0) + 1;

    if (owner.runtime.tharoxInerciaStacks < this.stacksNeeded) {
      return {
        log: `<b>[Passiva - Massa Inamolgável]</b> ${formatChampionName(owner)} acumulou Inércia (${owner.runtime.tharoxInerciaStacks}/${this.stacksNeeded}).`,
      };
    }

    owner.runtime.tharoxInerciaStacks = 0;

    const statResult = owner.modifyStat({
      statName: "Defense",
      amount: this.defBonus,
      context,
      isPermanent: true,
    });

    // Cura 3% do HP máximo para cada 50 de Defesa.
    const defenseMultipliers = Math.floor(owner.Defense / this.defensePerHealingStep);
    const healingAmount =
      owner.maxHP * this.healingPerMaxHP * defenseMultipliers;

    if (healingAmount > 0) {
      owner.heal(healingAmount, context, owner);
    }

    // Escudo equivalente a 7,5% do HP máximo.
    const shieldAmount = owner.maxHP * this.shieldPercentage;

    owner.addShield(shieldAmount, 0, context, "regular");

    let log =
      `<b>[Passiva - Massa Inamolgável]</b> ${formatChampionName(owner)} ` +
      `consumiu ${this.stacksNeeded} Inércia e ganhou +${this.defBonus} Defesa permanente! ` +
      `(Defesa: ${owner.Defense}).`;

    if (healingAmount > 0) {
      log += `\nCurou ${Math.floor(healingAmount)} HP (${defenseMultipliers} × ${this.healingPerMaxHP * 100}% do HP máximo).`;
    }

    log += `\nRecebeu um escudo de ${Math.floor(shieldAmount)} HP.`;

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },

  onTurnEnd({ owner, context }) {
    if (context.currentTurn !== owner.runtime.lastTauntTurn) {
      owner.runtime.tauntStreak = 0;
      // console.log(`[HOOK - onTurnEnd] ${owner.name} não usou Taunt no turno anterior. Taunt Streak resetada. ${owner.runtime.tauntStreak}`); // Log para debug
    }
  },
};
