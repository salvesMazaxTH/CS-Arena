export default {
  key: "carapace_of_spent_wars",
  name: "Carapace of Spent Wars",
  startingTier: 1,

  description() {
    return {
      en: `Every blade that ever broke on Xharkovar left a splinter behind, and his hide grew them into spines. He enters the field with permanent <b>Thorns</b>.`,
      pt: `Toda lâmina que já se partiu em Xharkovar deixou uma lasca para trás, e o couro dele as transformou em espinhos. Ele entra em campo com <b>Espinhos</b> permanentes.`,
    };
  },

  onChampionAdded({ owner, champion, context }) {
    if (champion !== owner) return;

    owner.applyStatusEffect(
      "thorns",
      Infinity,
      context,
      { persistent: true, sourceId: owner.id },
      this.startingTier,
    );
  },
};
