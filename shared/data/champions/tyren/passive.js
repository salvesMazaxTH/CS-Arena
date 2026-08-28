// shared/champions/tyren/passive.js

import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "living_metallurgy",
  name: "Living Metallurgy",

  shieldPercent: 20,
  bonusDamagePercent: 20,
  piercingPercentage: 30,

  description() {
    return `Tyren's Living Steel adapts to the nature of the force that strikes him.

    The first time each turn Tyren is struck, his body automatically restructures itself in response to the impact, granting a shield equal to ${this.shieldPercent}% of the damage received.

    Physical Damage causes his steel to harden, granting a regular Shield and empowering his next damaging attack to deal ${this.bonusDamagePercent}% increased damage.

    Magical Damage causes his steel to resonate with the incoming energy, granting a Spellshield and causing his next damaging ability to ignore ${this.piercingPercentage}% of the target's Defense.

    Each offensive adaptation is consumed when Tyren next deals damage.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, damage, type, context }) {
    if (damage <= 0) return;

    const runtime = (owner.runtime ??= {});

    // Only the first damage instance taken each turn triggers
    // Living Metallurgy's adaptation.
    if (
      runtime.livingMetallurgyLastTriggerTurn ===
      context.currentTurn
    ) {
      return;
    }

    runtime.livingMetallurgyLastTriggerTurn =
      context.currentTurn;

    const shieldAmount = Math.floor(
      damage * (this.shieldPercent / 100),
    );

    if (shieldAmount > 0) {
      // Magical damage creates a Spellshield.
      // All other damage uses the regular Shield fallback.
      if (type === "magical") {
        owner.addShield(1, 0, context, "spell");
      } else {
        owner.addShield(shieldAmount, 0, context);
      }
    }

    // Physical impact hardens Tyren's steel and empowers
    // his next damaging attack.
    if (type === "physical") {
      runtime.livingMetallurgyAdaptation = "physical";

      return {
        log:
          `<b>[Passive — ${this.name}]</b> ` +
          `${formatChampionName(owner)}'s Living Steel hardens against the physical impact, ` +
          `forming a ${shieldAmount} HP Shield and empowering his next attack.`,
      };
    }

    // Magical impact causes the Living Steel to resonate
    // with the incoming energy and prepare a piercing response.
    if (type === "magical") {
      runtime.livingMetallurgyAdaptation = "magical";

      return {
        log:
          `<b>[Passive — ${this.name}]</b> ` +
          `${formatChampionName(owner)}'s Living Steel resonates with the magical impact, ` +
          `forming a ${shieldAmount} HP Spellshield and preparing his next damaging ability ` +
          `to pierce ${this.piercingPercentage}% of the target's Defense.`,
      };
    }

    // Other damage types still trigger the defensive adaptation,
    // but do not prepare an offensive adaptation.
    return {
      log:
        `<b>[Passive — ${this.name}]</b> ` +
        `${formatChampionName(owner)}'s Living Steel adapts to the impact, ` +
        `forming a ${shieldAmount} HP Shield.`,
    };
  },

  onBeforeDmgDealing({
    owner,
    damage,
    skill,
  }) {
    const adaptation =
      owner.runtime?.livingMetallurgyAdaptation;

    if (!adaptation) return;

    // The offensive adaptation is consumed by the next
    // instance of damage Tyren deals.
    owner.runtime.livingMetallurgyAdaptation = null;

    if (adaptation === "physical") {
      const newDamage =
        damage * (1 + this.bonusDamagePercent / 100);

      return {
        damage: newDamage,
        log:
          `<b>[Passive — ${this.name}]</b> ` +
          `${formatChampionName(owner)} releases the hardened Living Steel, ` +
          `increasing the damage of ${skill?.name ?? "his attack"} by ` +
          `${this.bonusDamagePercent}%.`,
      };
    }

    if (adaptation === "magical") {
      return {
        piercingPercentage: this.piercingPercentage,
        log:
          `<b>[Passive — ${this.name}]</b> ` +
          `${formatChampionName(owner)} channels the stored magical resonance, ` +
          `causing ${skill?.name ?? "his ability"} to ignore ` +
          `${this.piercingPercentage}% of the target's Defense.`,
      };
    }
  },
};