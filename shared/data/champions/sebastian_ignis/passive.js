import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "idle_flame",
  name: "Idle Flame",

  apathyCap: 6,
  idleExemptSkillKeys: ["basic_strike", CLAIM_ACTION_KEY],

  description(champion) {
    const stacks = champion.runtime?.apathyStacks || 0;

    return `Sebastian only bothers to move when the alternative costs him more. Any turn he spends without using one of his own abilities — a Basic Strike or a CLAIM don't count — he banks 1 stack of Apathy (Max: ${this.apathyCap}). Whatever ability he finally commits to spends the whole bank at once.

    <b>Current Stacks: ${stacks}</b>`;
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, context }) {
    if (!skill?.key || this.idleExemptSkillKeys.includes(skill.key)) return;

    owner.runtime ??= {};
    owner.runtime.lastAbilityUseTurn = context.currentTurn;
  },

  onTurnEnd({ owner, context }) {
    if (owner.runtime?.lastAbilityUseTurn === context.currentTurn) return;

    owner.runtime ??= {};
    const stacks = owner.runtime.apathyStacks || 0;
    if (stacks >= this.apathyCap) return;

    owner.runtime.apathyStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} does nothing worth mentioning (${owner.runtime.apathyStacks}/${this.apathyCap} Apathy).`,
    };
  },
};
