import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import {
  CLAIM_ACTION_KEY,
  getClaimPoints,
} from "../../../engine/combat/claim.js";
import totalBlock from "../generic/totalBlock.js";

const MISERS_TOLL_HOOK_KEY = "misers_toll_hook";

const avarionSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // S1 — Gilded Assay
  // ========================
  {
    key: "gilded_assay",
    name: "Gilded Assay",
    bf: 60,
    attackShred: 20,
    shredDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "earth",

    description() {
      return `Avarion sets the chosen target on the scales of his crystal staff, appraises them and finds them wanting, dealing Earth magical damage.

      The verdict is written down: the target's Attack is reduced by ${this.attackShred} for ${this.shredDuration} turns.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => !r?.evaded && !r?.immune);

      if (!hitSuccess) return results;

      enemy.modifyStat({
        statName: "Attack",
        amount: -this.attackShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      context.registerDialog?.({
        message: `${formatChampionName(enemy)} was appraised and found wanting: -${this.attackShred} Attack!`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },

  // ========================
  // S2 — Miser's Toll
  // ========================
  {
    key: "misers_toll",
    name: "Miser's Toll",
    attackBonusPercent: 15,
    attackBonusDuration: 2,
    tollPoints: 2,
    contact: false,
    priority: 0,
    element: "earth",

    description() {
      return `Avarion draws the loose crystal of the field into his own hand, increasing his Attack by ${this.attackBonusPercent}% for ${this.attackBonusDuration} turns.

      He then hangs his toll gate over the enemy ledger: the next time an enemy champion uses Claim, that champion scores ${this.tollPoints} fewer points and Avarion's team collects those points instead.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Attack",
        amount: this.attackBonusPercent,
        duration: this.attackBonusDuration,
        isPercent: true,
        context,
        statModifierSrc: "misers_toll",
      });

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      const tollPoints = this.tollPoints;

      if (
        !user.runtime.hookEffects.some((he) => he.key === MISERS_TOLL_HOOK_KEY)
      ) {
        user.addHookEffect({
          type: "buff",
          key: MISERS_TOLL_HOOK_KEY,
          group: "skill",
          // No hookScope: the toll watches the enemy's Claim, not Avarion's
          // own actions, so this hook must run on every resolved action rather
          // than only on the ones Avarion is the source of.

          onActionResolved({ owner, actionSource, skill, context }) {
            if (skill?.key !== CLAIM_ACTION_KEY) return;
            if (!owner?.alive) return;
            if (!actionSource || actionSource.team === owner.team) return;

            // The Claim has already scored by the time this hook runs.
            // `preActionClaimPoints` is the number the resolver actually
            // awarded; recomputing it is only a fallback for contexts that do
            // not publish it.
            const claimedPoints = Number(
              context?.preActionClaimPoints ??
                getClaimPoints(actionSource, context?.currentTurn),
            );

            // A toll can never take back more than the Claim brought in, even
            // if several tolls land on the same Claim, so what previous tolls
            // already took is tracked on the action's own context.
            const alreadyTolled = Number(context?.misersTollCollected ?? 0);
            const collected = Math.min(
              tollPoints,
              claimedPoints - alreadyTolled,
            );

            if (!(collected > 0)) return;

            if (context) context.misersTollCollected = alreadyTolled + collected;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== MISERS_TOLL_HOOK_KEY,
            );

            // The collected half is registered on Avarion's side; the returned
            // result carries the matching deduction on the claimer's side.
            context?.registerScore?.({
              amount: collected,
              scoringSlot: owner.team - 1,
              reason: MISERS_TOLL_HOOK_KEY,
              sourceId: owner.id,
            });

            return {
              type: "score",
              amount: -collected,
              scoringSlot: actionSource.team - 1,
              log: `${formatChampionName(owner)} levied <b>Miser's Toll</b> on ${formatChampionName(actionSource)}'s Claim, diverting ${collected} point(s) to his own ledger.`,
            };
          },
        }, context);
      }

      return {
        log: `${formatChampionName(user)} gathered the loose crystal of the field and hung <b>Miser's Toll</b> over the enemy ledger.`,
      };
    },
  },

  // ========================
  // S3 (ULTIMATE) — Weight of the Ledger
  // ========================
  {
    key: "weight_of_the_ledger",
    name: "Weight of the Ledger",
    bf: 115,
    attackShred: 30,
    shredDuration: 3,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "earth",

    description() {
      return `Avarion closes the ledger on the chosen target, and every debt he ever recorded against them comes down at once as crystallized stone, dealing massive Earth magical damage.

      The entry stays open against them: the target's Attack is reduced by ${this.attackShred} for ${this.shredDuration} turns.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => !r?.evaded && !r?.immune);

      if (!hitSuccess) return results;

      enemy.modifyStat({
        statName: "Attack",
        amount: -this.attackShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      context.registerDialog?.({
        message: `${formatChampionName(enemy)} was written down in the ledger: -${this.attackShred} Attack for ${this.shredDuration} turns!`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },
];

export default avarionSkills;
