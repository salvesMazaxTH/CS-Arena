import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "weight_of_the_bolt",
  name: "Weight of the Bolt",

  onHitMaxHPPercent: 6,
  poisonedStacks: 1,

  description() {
    return `Julian will not stoop to aiming for the weak point — a bolt of his, buried anywhere, outweighs a lesser marksman's perfect shot. His two special bolts each carry bonus damage equal to ${this.onHitMaxHPPercent}% of the chosen target's Max HP as Piercing damage, and every bolt he fires — the ultimate among them — leaves any target not already Poisoned with ${this.poisonedStacks} stack of Poisoned from the coating he mixes himself.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, attacker, defender, damage, context }) {
    if (!(damage > 0)) return;
    if (!defender || defender.team === owner.team) return;
    if (defender.hasStatusEffect("poisoned")) return;

    defender.applyStatusEffect(
      "poisoned",
      undefined,
      context,
      { sourceId: owner.id, sourceName: owner.name },
      this.poisonedStacks,
    );

    return {
      log: `[PASSIVE — ${this.name}] the venom on ${formatChampionName(attacker)}'s bolt leaves ${formatChampionName(defender)} Poisoned.`,
    };
  },
};
