import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export const WANTED_RUNTIME_FLAG = "harlanWanted";

export default {
  key: "quickdraw",
  name: "Quickdraw",

  quickdrawBonusDmgPercent: 20,
  halfStepReductionPercent: 50,
  halfStepMarkDuration: 2,
  wantedBonusPoints: 2,

  description() {
    return `Harlan never pulls the trigger on a fight he isn't sure he already won the draw on. Whenever he fires on someone slower to the trigger than he is, the shot cannot be evaded and lands for ${this.quickdrawBonusDmgPercent}% bonus damage — and whatever they've still got left to fire back comes out ${this.halfStepReductionPercent}% weaker, just this once.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
  },

  clearHalfStepMarks(owner, champions) {
    for (const champion of champions) {
      if (champion.team === owner.team) continue;
      delete champion.runtime.harlanHalfStepUntilTurn;
    }
  },

  onTurnStart({ owner, context }) {
    for (const champion of context.aliveChampions) {
      if (champion.team === owner.team) continue;

      const until = champion.runtime.harlanHalfStepUntilTurn;
      if (until === undefined || until > context.currentTurn) continue;

      delete champion.runtime.harlanHalfStepUntilTurn;
    }
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;

    this.clearHalfStepMarks(owner, context.aliveChampions);

    const targetId = owner.runtime?.harlanWantedTargetId;
    if (targetId) {
      const target = context.aliveChampions.find((c) => c.id === targetId);
      if (target) delete target.runtime[WANTED_RUNTIME_FLAG];
    }
    delete owner.runtime.harlanWantedTargetId;
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, context }) {
    if (attacker !== owner) return;
    if (!(Number(defender?.Speed) < Number(owner.Speed))) return;

    defender.runtime ??= {};
    defender.runtime.harlanHalfStepUntilTurn =
      context.currentTurn + this.halfStepMarkDuration;

    context.registerDialog({
      message: `${formatChampionName(owner)} already put the bullet where the other man's watch just stopped.`,
      sourceId: owner.id,
      targetId: defender.id,
    });

    return {
      damage: Number(damage) * (1 + this.quickdrawBonusDmgPercent / 100),
    };
  },

  onBeforeDmgTaking({ owner, attacker, damage }) {
    if (attacker?.runtime?.harlanHalfStepUntilTurn === undefined) return;

    delete attacker.runtime.harlanHalfStepUntilTurn;

    return {
      damage: Number(damage) * (1 - this.halfStepReductionPercent / 100),
    };
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || actionSource !== owner) return;

    const targetId = owner.runtime?.harlanWantedTargetId;
    if (!targetId) return;
    if (!context.aliveChampions.some((c) => c.id === targetId)) return;

    context.registerScore({
      amount: this.wantedBonusPoints,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} collects on the mandate still walking around — ${this.wantedBonusPoints} extra point(s).`,
    };
  },
};
