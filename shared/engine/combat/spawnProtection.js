import { formatChampionName } from "../../ui/formatters.js";

// Cleared by the start-of-turn sweep, so its presence alone means "still arriving".
export class SpawnProtection {
  static label = "Taking the Field";

  static grant(champion) {
    champion.runtime ??= {};
    champion.runtime.takingTheField = true;
  }

  static isActive(champion) {
    return champion?.runtime?.takingTheField === true;
  }

  static clear(champion) {
    delete champion.runtime.takingTheField;
  }

  static actionDenial(champion) {
    if (!this.isActive(champion)) return null;

    return {
      denied: true,
      reason: "takingTheField",
      message: `${formatChampionName(champion)} is still taking the field and cannot act this turn.`,
    };
  }

  static unreachableMessage(champion) {
    return `${formatChampionName(champion)} is still taking the field and cannot be reached.`;
  }
}
