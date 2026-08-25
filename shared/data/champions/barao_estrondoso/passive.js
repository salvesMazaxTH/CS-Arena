// shared/champions/barao_estrondoso/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "cataclysmic_reactor",
  name: "Cataclysmic Reactor",
  storageBasePercent: 75,
  storageShieldPercent: 110,
  damageTakenBonusPercent: 10,
  damageTakenBonusFlatMin: 10,
  storageCap: 250,
  description(champion) {
    const stored = champion.runtime?.storedDamage || 0;

    return `
    The Barão converts damage taken into destructive energy.

    He takes +${this.damageTakenBonusPercent}% bonus damage (does not apply to absolute damage and DoT).

    ${this.storageBasePercent}% of the damage taken is stored (Max.: ${this.storageCap}). While Reinforced Plating holds, that rate rises to ${this.storageShieldPercent}%.

    Stored Damage: <b>${stored > 0 ? stored : 0}</b>

    Reactor Overload:
    The core never vents what it has just unleashed. Whenever the Barão uses a skill, he becomes Stunned on the following turn.
    His Basic Attack and his CLAIM demand nothing from the reactor, and never leave him Stunned.

    Final Blast:
    When the Barão uses his Ultimate, he deals bonus damage equal to his total Stored Damage and resets it to 0.`;
  },

  // 🔴 Takes 10% additional damage (minimum +10)
  onBeforeDmgTaking({ attacker, defender, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const bonus = Math.max(
      this.damageTakenBonusFlatMin,
      damage * (this.damageTakenBonusPercent / 100),
    );
    const modifiedDamage = damage + bonus;

    return {
      damage: modifiedDamage,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const platingHolds =
      (owner.runtime.reinforcedPlatingUntilTurn ?? 0) > context.currentTurn;

    const storageRate = platingHolds
      ? this.storageShieldPercent / 100
      : this.storageBasePercent / 100;

    const stored = damage * storageRate;

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      this.storageCap,
      (owner.runtime.storedDamage || 0) + stored,
    );
  },

  hookScope: {
    // Only fires when the Barão is the one acting, never when he is a target.
    onActionResolved: "actionSource",
  },

  // Actions that never overload the reactor: the Basic Attack and the CLAIM.
  overloadExemptSkillKeys: ["basic_strike", CLAIM_ACTION_KEY],

  // 🔴 After using any ability (except Basic Attack and CLAIM), becomes Stunned on the
  // NEXT turn. The Stun must not be applied here: actions resolve at the end of
  // the turn, so a Stun applied on the spot would either be wasted (this turn's
  // action is already resolved) or linger into the turn after it. Instead it is
  // scheduled for the next turn, where handleStartTurn applies it with a
  // duration of 1 — long enough to deny that turn's action, gone by the
  // following start-of-turn purge.
  onActionResolved({ actionSource, owner, context, skill }) {
    if (!skill?.key) return;

    if (this.overloadExemptSkillKeys.includes(skill.key)) return;

    if (typeof context?.schedule !== "function") {
      console.warn(
        "[Passive - Barão] Reactor Overload could not be scheduled: no schedulable context.",
      );
      return;
    }

    const turnToHappen = (context.currentTurn ?? 0) + 1;

    owner.runtime ??= {};
    // Guards against scheduling the same Stun twice (e.g. a champion that acts
    // more than once in a turn).
    if (owner.runtime.overloadStunScheduledForTurn === turnToHappen) return;
    owner.runtime.overloadStunScheduledForTurn = turnToHappen;

    context.schedule({
      type: "applyStatusEffect",
      turnToHappen,
      payload: {
        targetId: owner.id,
        statusEffectKey: "stunned",
        duration: 1,
        dialog: `${formatChampionName(owner)} is <b>Stunned</b> by the <b>Reactor Overload</b>!`,
      },
    });

    return {
      log: `${formatChampionName(owner)} suffered <b>Reactor Overload</b> and will become <b>Stunned</b> next turn!`,
    };
  },
};
