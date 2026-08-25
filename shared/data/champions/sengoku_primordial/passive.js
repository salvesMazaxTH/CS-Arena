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

  onValidateAction({ actionSource, owner }) {
    if (!actionSource || actionSource.team === owner.team) return;

    if (actionSource.Attack >= owner.Attack * this.threshold) return;

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} buckles under a colossal presence and fails to act against ${formatChampionName(owner)}!`,
    };
  },
};
