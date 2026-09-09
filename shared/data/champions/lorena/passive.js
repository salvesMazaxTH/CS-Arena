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

  clearMarks(owner, champions, { onlyStale = true, currentTurn = 0 } = {}) {
    for (const champion of champions) {
      if (champion.team === owner.team) continue;

      const until = champion.runtime.lorenaMarkUntilTurn;
      if (until === undefined) continue;
      if (onlyStale && until > currentTurn) continue;

      delete champion.runtime.lorenaMarkUntilTurn;
    }
  },

  // Nothing else clears the mark, and a stale one would sit on the enemy's
  // portrait long after Lorena could still cash it.
  onTurnStart({ owner, context }) {
    this.clearMarks(owner, context.aliveChampions, {
      currentTurn: context.currentTurn,
    });
  },

  // Only Lorena can cash a mark, so hers leave the board with her.
  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;
    this.clearMarks(owner, context.aliveChampions, { onlyStale: false });
  },

  onBeforeDmgDealing({ owner, defender, crit, context }) {
    if (defender?.runtime?.lorenaMarkUntilTurn === undefined) return;

    // The mark is a one-shot promise: it pays out once, then it's gone.
    delete defender.runtime.lorenaMarkUntilTurn;

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
