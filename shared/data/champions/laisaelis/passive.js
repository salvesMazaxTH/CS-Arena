import { formatChampionName } from "../../../ui/formatters.js";
import { dieWithTwin, TWIN_BOND_TEXT } from "../pairs/twinBond.js";

export default {
  key: "the_one_that_remains",
  name: "The One That Remains",

  survivalHP: 1,

  description(champion) {
    return `Laisaelis is the sister who looks at something about to stop being and simply answers that it is here. The first lethal effect that would end her does not: she stays on the field with ${this.survivalHP} HP, once per match. ${TWIN_BOND_TEXT}

    <b>Still unspent:</b> ${champion.runtime?.remainSpent ? "no" : "yes"}`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  // Death is death whatever the source, so poison and recoil must reach it too.
  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (owner.runtime.remainSpent) return;
    if (owner.HP - damage > 0) return;

    owner.runtime.remainSpent = true;
    // Must outlive this hook: the finishing step reads it after the damage lands.
    owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

    context.registerDialog({
      message: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} should be gone, and remains anyway.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: Math.max(owner.HP - this.survivalHP, 0),
      log: `${formatChampionName(owner)} holds on with ${this.survivalHP} HP.`,
    };
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
