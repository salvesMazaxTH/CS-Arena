import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "unyielding_mass",
  name: "Unyielding Mass",
  stacksNeeded: 3,
  defBonus: 15,
  healingPerMaxHP: 0.015,
  defensePerHealingStep: 75,
  shieldPercentage: 0.05,
  sustainHpThreshold: 0.70,
  description() {
    return {
      en: `Whenever Tharox is struck, he gains <b>1</b> Inertia stack. At <b>${this.stacksNeeded}</b>, consume them and gain +<b>${this.defBonus}</b> permanent <b>Defense</b>. If his <b>HP</b> is at <b>${this.sustainHpThreshold * 100}%</b> or below, he additionally heals for <b>${this.healingPerMaxHP * 100}%</b> of his <b>Max HP</b> for every <b>${this.defensePerHealingStep}</b> <b>Defense</b> he has and gains a shield equivalent to <b>${this.shieldPercentage * 100}%</b> of his <b>Max HP</b>.`,
      pt: `Sempre que é golpeado, Tharox ganha <b>1</b> stack de Inércia. Ao atingir <b>${this.stacksNeeded}</b>, ele as consome e ganha +<b>${this.defBonus}</b> de <b>Defesa</b> permanente. Se seu <b>HP</b> estiver em <b>${this.sustainHpThreshold * 100}%</b> ou menos, ele também se cura em <b>${this.healingPerMaxHP * 100}%</b> de seu <b>HP Máximo</b> para cada <b>${this.defensePerHealingStep}</b> de <b>Defesa</b> que possui e ganha um escudo equivalente a <b>${this.shieldPercentage * 100}%</b> de seu <b>HP Máximo</b>.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, owner, actualDmg, context }) {
    if (!(actualDmg > 0) || attacker.id === owner.id) return;

    owner.runtime.tharoxLastHitTurn = context.currentTurn;

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

    let log =
      `<b>[Passive - Unyielding Mass]</b> ${formatChampionName(owner)} ` +
      `consumed ${this.stacksNeeded} Inertia and gained +${this.defBonus} permanent Defense! ` +
      `(Defense: ${owner.Defense}).`;

    if (owner.HP / owner.maxHP <= this.sustainHpThreshold) {
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

        log += `\nHealed ${Math.floor(healingAmount)} HP (${defenseMultipliers} × ${this.healingPerMaxHP * 100}% of Max HP).`;
      }

      const shieldAmount = owner.maxHP * this.shieldPercentage;
      owner.addShield(shieldAmount, 0, context, "regular");

      log += `\nGained a shield of ${Math.floor(shieldAmount)} HP.`;
    }

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },

  onTurnEnd({ owner, context }) {
    if (context.currentTurn !== owner.runtime.lastTauntTurn) {
      owner.runtime.tauntStreak = 0;
    }
  },
};
