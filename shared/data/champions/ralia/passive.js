export default {
  key: "disdain",
  name: "Disdain",
  description() {
    return `Rália gives fortune no credit. Critical Hits against her are denied and land as ordinary damage instead.`;
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
