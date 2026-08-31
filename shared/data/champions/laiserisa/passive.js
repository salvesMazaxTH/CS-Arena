import { formatChampionName } from "../../../ui/formatters.js";
import {
  dieWithTwin,
  findTwin,
  survivalDamage,
  TWIN_BOND_TEXT,
  wouldBeLethal,
} from "../pairs/twinBond.js";

export default {
  key: "the_one_that_leaves",
  name: "The One That Leaves",

  vanishTurns: 2,
  returnHPPercent: 25,

  description(champion) {
    return `Laiserisa is the sister who answers presence by letting it go: nothing she touches is destroyed, only allowed to stop being. The first lethal effect that would end her instead empties her to a sliver, and at the start of the next turn she slips into the Nothingness, returning ${this.vanishTurns} turns later with ${this.returnHPPercent}% of her base Max HP — and should her sister have fallen meanwhile, she returns only to cease. Once per match. ${TWIN_BOND_TEXT}

    <b>Still unspent:</b> ${champion.runtime?.leaveSpent ? "no" : "yes"}`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onValidateAction: "actionSource",
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onValidateAction({ actionSource, skill, context }) {
    if (skill?.key !== "then_let_me_take_you_with_me") return;
    if (findTwin(actionSource, context)) return;

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} reaches for her sister and finds no one to take with her.`,
    };
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (owner.runtime.leaveSpent) return;
    if (!wouldBeLethal(owner, damage)) return;

    // Either binding answers the same lethal hit, and outranks the passive:
    // twin_departure takes both sisters, keep_you_here shields this one for free.
    if (
      owner.runtime.hookEffects?.some(
        (e) => e.key === "twin_departure" || e.key === "keep_you_here",
      )
    )
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
      damage: survivalDamage(owner, 1),
      log: `${formatChampionName(owner)} holds on by a thread.`,
    };
  },

  onTurnStart({ owner, context }) {
    if (owner.runtime.leavePending) {
      delete owner.runtime.leavePending;
      // Held across the stay: the Nothingness hides who is merely away from who is gone.
      owner.runtime.twinAtDeparture = findTwin(owner, context);

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
        log: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} lets go.`,
      };
    }

    const twin = owner.runtime.twinAtDeparture;
    if (!twin) return;

    delete owner.runtime.twinAtDeparture;
    if (twin.alive) return;

    owner.HP = 0;
    owner.alive = false;

    const orphaned = `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} steps back out of the Nothingness, finds ${formatChampionName(twin)} gone, and has nothing left to remain for.`;

    context.registerDialog({
      message: orphaned,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return { log: orphaned };
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
