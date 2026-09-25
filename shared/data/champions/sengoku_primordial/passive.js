import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "colossal_presence",
  name: "Colossal Presence",
  hookScope: {
    onValidateAction: "target",
  },
  threshold: 0.4, // Fraction of Sengoku's Attack
  description() {
    return {
      en: `Standing before Sengoku Primordial is a weight of its own. Enemies with less than <b>${this.threshold * 100}%</b> of his <b>Attack</b> cannot bring themselves to target him at all — their action simply fails.`,
      pt: `Ficar diante de Sengoku Primordial já é, por si só, um peso a carregar. Inimigos com menos de <b>${this.threshold * 100}%</b> do <b>Ataque</b> dele não conseguem reunir coragem para mirá-lo — a ação deles simplesmente falha.`,
    };
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
