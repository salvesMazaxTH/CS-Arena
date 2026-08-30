import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "slower_than_the_storm",
  name: "Slower Than the Storm",

  slowEnough: 75,

  description() {
    return `To Thorwells a mortal's swing is a letter posted a week too early — he reads its whole arc and is simply elsewhere when it lands. The first instance of damage each turn from an attacker whose Speed is ${this.slowEnough} or lower is evaded outright; Absolute Damage, and blows that cannot be evaded, still find him.`;
  },

  hookScope: {
    onDamageIncoming: "defender",
  },

  onDamageIncoming({ attacker, defender, owner, skill, damage, mode, context }) {
    if (defender !== owner) return;
    if (!attacker || attacker.team === owner.team) return;
    if (!(damage > 0)) return;

    // These never reach the evade branch anyway; bail early so the once-per-turn
    // read is not spent on a blow it could not have stepped through.
    if (mode === "absolute" || skill?.cannotBeEvaded) return;
    if (context?.isDot || (context?.damageDepth ?? 0) > 0) return;

    if (owner.runtime.slowerThanStormTurn === context.currentTurn) return;
    if (Number(attacker.Speed) > this.slowEnough) return;

    owner.runtime.slowerThanStormTurn = context.currentTurn;

    context.registerDialog?.({
      message: `${formatChampionName(attacker)}'s blow was loosed a week too early — ${formatChampionName(owner)} is not where it falls.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      evade: true,
      message: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} reads ${formatChampionName(attacker)} and steps clean through the blow.`,
    };
  },
};
