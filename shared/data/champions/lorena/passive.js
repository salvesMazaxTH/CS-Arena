import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "wink_then_bang",
  name: "Wink, Then Bang",

  markedCritBonus: 70,
  lastLaughPoints: 1,

  description() {
    return `Lorena's aim is less a skill than an inside joke only she finds funny — because she never misses. Once she's marked a target, her next hit against them is always a critical hit, landing at ${(1 + this.markedCritBonus / 100).toFixed(2)}x instead of the usual multiplier. If that hit is the one that puts them down, her player takes ${this.lastLaughPoints} point from the other side of the board — the last laugh.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ owner, defender, crit, context }) {
    if (!defender?.runtime?.lorenaMarked) return;

    // The mark is a one-shot promise: it pays out once, then it's gone.
    delete defender.runtime.lorenaMarked;

    // onAfterDmgDealing reads this to know the killing blow cashed the mark.
    owner.runtime.lorenaLastLaugh = {
      id: defender.id,
      turn: context?.currentTurn,
    };

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

  onAfterDmgDealing({ owner, defender, context }) {
    const pending = owner.runtime.lorenaLastLaugh;
    if (
      !pending ||
      pending.id !== defender?.id ||
      pending.turn !== context?.currentTurn
    ) {
      return;
    }

    owner.runtime.lorenaLastLaugh = null;

    if (defender.alive) return;

    const victimSlot = defender.team - 1;
    const stolen = Math.min(this.lastLaughPoints, context.getScore(victimSlot));
    if (stolen <= 0) return;

    context.registerScore({
      amount: stolen,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });
    context.registerScore({
      amount: -stolen,
      scoringSlot: victimSlot,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} gets the last laugh on ${formatChampionName(defender)} — ${stolen} point(s) taken from the other side of the board.`,
    };
  },
};
