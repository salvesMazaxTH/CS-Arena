import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "unyielding_mass",
  name: "Unyielding Mass",
  stacksNeeded: 3,
  defBonus: 15,
  healingPerMaxHP: 0.025,
  defensePerHealingStep: 75,
  shieldPercentage: 0.075,
  description() {
    return `Whenever Tharox is struck, he gains 1 Inertia stack. At ${this.stacksNeeded}, consume them and gain +${this.defBonus} permanent Defense. Additionally, he heals for ${this.healingPerMaxHP * 100}% of his Max HP for every ${this.defensePerHealingStep} Defense he has and gains a shield equivalent to ${this.shieldPercentage * 100}% of his Max HP.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, owner, actualDmg, context }) {
    if (!(actualDmg > 0) || attacker.id === owner.id) return;

    owner.runtime.tharoxInerciaStacks =
      (owner.runtime.tharoxInerciaStacks || 0) + 1;

    if (owner.runtime.tharoxInerciaStacks < this.stacksNeeded) {
      return {
        log: `<b>[Passive - Unyielding Mass]</b> ${formatChampionName(owner)} gained Inertia (${owner.runtime.tharoxInerciaStacks}/${this.stacksNeeded}).`,
      };
    }

    owner.runtime.tharoxInerciaStacks = 0;

    const statResult = owner.modifyStat({
      statName: "Defense",
      amount: this.defBonus,
      context,
      isPermanent: true,
    });

    const defenseMultipliers = Math.floor(owner.Defense / this.defensePerHealingStep);
    const healingAmount =
      owner.maxHP * this.healingPerMaxHP * defenseMultipliers;

    if (healingAmount > 0) {
      new HealEvent({
        target: owner,
        amount: healingAmount,
        context,
        source: owner,
      }).execute();
    }

    const shieldAmount = owner.maxHP * this.shieldPercentage;

    owner.addShield(shieldAmount, 0, context, "regular");

    let log =
      `<b>[Passive - Unyielding Mass]</b> ${formatChampionName(owner)} ` +
      `consumed ${this.stacksNeeded} Inertia and gained +${this.defBonus} permanent Defense! ` +
      `(Defense: ${owner.Defense}).`;

    if (healingAmount > 0) {
      log += `\nHealed ${Math.floor(healingAmount)} HP (${defenseMultipliers} × ${this.healingPerMaxHP * 100}% of Max HP).`;
    }

    log += `\nGained a shield of ${Math.floor(shieldAmount)} HP.`;

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
