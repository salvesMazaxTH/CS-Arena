export default {
  key: "wink_then_bang",
  name: "Wink, Then Bang",

  markedCritBonus: 70,

  description() {
    return `Lorena's aim is less a skill than an inside joke only she finds funny — because she never misses. Once she's marked a target, her next hit against them is always a critical hit, landing at ${(1 + this.markedCritBonus / 100).toFixed(2)}x instead of the usual multiplier.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ owner, defender, crit }) {
    if (!defender?.runtime?.lorenaMarked) return;

    // The mark is a one-shot promise: it pays out once, then it's gone.
    delete defender.runtime.lorenaMarked;

    return {
      crit: {
        ...(crit ?? {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus: this.markedCritBonus,
      },
    };
  },
};
