import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "colossal_presence",
  name: "Colossal Presence",
  hookScope: {
    onValidateAction: "target",
  },
  threshold: 0.4, // Fraction of Sengoku's Attack
  description() {
    return `Standing before Sengoku Primordial is a weight of its own. Enemies with less than ${this.threshold * 100}% of his Attack cannot bring themselves to target him at all — their action simply fails.`;
  },
  /**
   * Blocks actions from enemies below the Attack threshold.
   * @param {object} params - Hook parameters
   * @param {object} params.action - The action object
   * @param {object} params.actionSource - The champion attempting to act
   * @param {object} params.target - The action's target (always Sengoku here)
   * @param {object} params.context - The combat context
   * @param {object} params.owner - Sengoku himself
   */
  onValidateAction({ action, actionSource, target, context, owner }) {
    // Never blocks self-targeting.
    if (!actionSource || actionSource.id === owner.id) return;

    // Block attackers below the Attack threshold.
    const threshold = owner.Attack * this.threshold;
    if (
      typeof actionSource.Attack !== "number" ||
      actionSource.Attack >= threshold
    )
      return;

    const message = `${formatChampionName(actionSource)} buckles under a colossal presence and fails to act against ${formatChampionName(owner)}!`;
    if (context?.registerDialog) {
      context.registerDialog({
        message,
        sourceId: actionSource.id,
        targetId: owner.id,
      });
    }
    return {
      deny: true,
      message,
    };
  },
};
