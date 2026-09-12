import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "unwitnessed",
  name: "Unwitnessed",

  momentumGain: 9,

  // No live counter here on purpose: the champion card is one of the few places
  // the double could read differently from the man.
  description() {
    return `Silas has spent most of his life in rooms where nobody knew he was standing, and he stopped minding a long time ago. Whenever a full turn passes without a single wound reaching him, he opens the next one ${this.momentumGain} Momentum richer. Nothing has ever made Silas hurry: his Speed cannot be reduced.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
    onStatModifierIncoming: "target",
  },

  onStatModifierIncoming({ owner, statName, amount }) {
    if (statName !== "Speed" || amount >= 0) return;

    return {
      cancel: true,
      message: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} keeps his own time — his Speed holds.`,
    };
  },

  onAfterDmgTaking({ owner, defender, actualDmg, context }) {
    if (defender !== owner) return;
    if (!(actualDmg > 0)) return;

    owner.runtime.silasLastDamagedTurn = context?.currentTurn ?? null;
  },

  onActionResolved({ owner, context }) {
    owner.runtime.silasLastActedTurn = context?.currentTurn ?? null;
  },

  onTurnStart({ owner, context }) {
    if (owner.runtime.silasMirageOwnerId) return;

    const previousTurn = (context?.currentTurn ?? 0) - 1;
    if (previousTurn < 1) return;
    if (owner.runtime.silasLastDamagedTurn === previousTurn) return;

    const gained = owner.addMomentum({ amount: this.momentumGain });
    if (!gained) return;

    context?.registerDialog?.({
      message: `<b>[Passive — ${this.name}]</b> nothing reached ${formatChampionName(owner)} last turn — +${gained} Momentum.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} went unwitnessed, and gains ${gained} Momentum.`,
    };
  },
};
