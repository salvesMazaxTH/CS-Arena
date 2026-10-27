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

  // Combat flow a still-arriving champion sits out: damage, healing, status.
  // Non-combat hooks (turn start, roster changes) still reach it.
  static SUPPRESSED_HOOKS = new Set([
    "onDamageIncoming",
    "onBeforeDmgDealing",
    "onBeforeDmgTaking",
    "onAfterDmgDealing",
    "onAfterDmgTaking",
    "onEvade",
    "onCriticalHit",
    "onBeforeHealing",
    "onAfterHealing",
    "onStatusEffectIncoming",
    "onStatusEffectApplied",
    "onHookEffectIncoming",
    "onChampionDeath",
    "onBuffingStat",
  ]);

  static blocksReaction(eventName, champion) {
    return this.isActive(champion) && this.SUPPRESSED_HOOKS.has(eventName);
  }

  static clear(champion) {
    delete champion.runtime.takingTheField;
  }

  static actionDenial(champion) {
    if (!this.isActive(champion)) return null;

    return {
      denied: true,
      reason: "takingTheField",
      message: {
        en: `${formatChampionName(champion)} is still taking the field and cannot act this turn.`,
        pt: `${formatChampionName(champion)} ainda está entrando em campo e não pode agir neste turno.`,
      },
    };
  }

  static unreachableMessage(champion) {
    return {
      en: `${formatChampionName(champion)} is still taking the field and cannot be reached.`,
      pt: `${formatChampionName(champion)} ainda está entrando em campo e não pode ser alcançado.`,
    };
  }
}
