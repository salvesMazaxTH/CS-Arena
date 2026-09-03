import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "live_current",
  name: "Live Current",
  speedBuff: 10,
  paralyzeChance: 20,
  paralyzeDuration: 2,
  groundingWindow: 2,
  description() {
    return `A current never stops running through Node-SPARCKINA-07's frame. Every turn, the surge builds and raises its Speed by ${this.speedBuff}%.

    Whenever it deals damage, there is a ${this.paralyzeChance}% chance the discharge locks the target's body down, applying Paralyzed for ${this.paralyzeDuration} turn(s).

    A CLAIM winds the discharge instead of loosing it: the next hit it lands, this turn or the next, is a certain Paralyze.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    owner.runtime ??= {};
    owner.runtime.groundingCycleUntilTurn =
      context.currentTurn + this.groundingWindow;

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} winds the discharge through the CLAIM — its next hit is a certain Paralyze.`,
    };
  },

  onTurnStart({ owner, context }) {
    const result = owner.modifyStat({
      statName: "Speed",
      amount: this.speedBuff,
      context,
      isPermanent: true,
      isPercent: true,
    });

    if (result?.appliedAmount === 0) return;

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} gains +${result?.appliedAmount ?? this.speedBuff} Speed.`,
    };
  },

  onAfterDmgDealing({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    const grounded =
      owner.runtime?.groundingCycleUntilTurn != null &&
      context.currentTurn < owner.runtime.groundingCycleUntilTurn;

    // Spent on the next damaging hit, land or not.
    if (grounded) owner.runtime.groundingCycleUntilTurn = null;

    const success = grounded || Math.random() < this.paralyzeChance / 100;

    if (!success) return;

    const paralyzed = defender.applyStatusEffect(
      "paralyzed",
      this.paralyzeDuration,
      context,
      {
        sourceId: owner.id,
        sourceName: owner.name,
      },
    );

    if (!paralyzed) return;

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(attacker)} leaves ${formatChampionName(defender)} Paralyzed for ${this.paralyzeDuration} turn(s)!`,
    };
  },
};
