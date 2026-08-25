export default {
  key: "wink_then_bang",
  name: "Wink, Then Bang",

  markedCritBonus: 70,

  description() {
    return `Lorena's aim is less a skill than an inside joke only she finds funny — because she never misses. Once she's marked a target, her next hit against them is always a critical hit, landing at 1.${this.markedCritBonus}x instead of the usual multiplier.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ owner, defender, crit }) {
    if (defender?.runtime?.lorenaMarkedBy !== owner) return;

    // The mark is a one-shot promise: it pays out once, then it's gone.
    defender.runtime.lorenaMarkedBy = null;

    return {
      crit: { ...(crit ?? {}), didCrit: true, bonus: this.markedCritBonus },
    };
  },
};
