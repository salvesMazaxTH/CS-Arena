export default {
  key: "disdain",
  name: "Disdain",
  description() {
    return {
      en: `Rália gives fortune no credit. <b>Critical Hits</b> against her are denied and land as ordinary damage instead.`,
      pt: `Rália não dá crédito algum à sorte. <b>Acertos Críticos</b> contra ela são negados e chegam como dano comum.`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking({ crit }) {
    if (!crit.didCrit) return;

    return {
      crit: {
        ...crit,
        didCrit: false,
        bonus: 0,
        forced: false,
        critExtra: 0,
      },
    };
  },
};
