import { formatChampionName } from "../../../ui/formatters.js";
import { dieWithTwin, TWIN_BOND_TEXT } from "../pairs/twinBond.js";

export default {
  key: "the_one_that_leaves",
  name: "The One That Leaves",

  vanishTurns: 2,
  returnHPPercent: 25,

  description(champion) {
    return `Laiserisa is the sister who answers presence by letting it go: nothing she touches is destroyed, only allowed to stop being. The first lethal effect that would end her instead empties her to a sliver, and at the start of the next turn she slips into the Nothingness, returning ${this.vanishTurns} turns later with ${this.returnHPPercent}% of her base Max HP. Once per match. ${TWIN_BOND_TEXT}

    <b>Still unspent:</b> ${champion.runtime?.leaveSpent ? "no" : "yes"}`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (owner.runtime.leaveSpent) return;
    if (owner.HP - damage > 0) return;

    // The ultimate's binding answers the same lethal hit, and takes precedence.
    if (owner.runtime.hookEffects?.some((e) => e.key === "twin_departure"))
      return;

    owner.runtime.leaveSpent = true;
    owner.runtime.leavePending = true;
    owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

    context.registerDialog({
      message: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} is emptied to a sliver, and begins to let go.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: Math.max(owner.HP - 1, 0),
      log: `${formatChampionName(owner)} holds on by a thread.`,
    };
  },

  onTurnStart({ owner, context }) {
    if (!owner.runtime.leavePending) return;
    delete owner.runtime.leavePending;

    context.schedule({
      type: "championMutation",
      turnToHappen: context.currentTurn,
      payload: {
        targetId: owner.id,
        mode: "vanish",
        turns: this.vanishTurns,
        returnState: { hpRatio: this.returnHPPercent / 100 },
      },
    });

    return {
      log: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} slips into the Nothingness.`,
    };
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
