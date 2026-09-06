import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "hunger_of_the_flame",
  name: "Hunger of the Flame",

  maxStacks: 5,
  dmgPerStackPercent: 4,

  description(champion) {
    const stacks = champion.runtime?.emberStacks || 0;

    return `Every wound just feeds it. Whenever it takes damage, it gains 1 Ember stack (Max: ${this.maxStacks}), and each stack adds ${this.dmgPerStackPercent}% bonus damage to its own attacks.

    <b>Current Embers: ${stacks}/${this.maxStacks}</b>`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onAfterDmgTaking({ owner, actualDmg }) {
    if (!(actualDmg > 0) || !owner.alive) return;

    owner.runtime ??= {};
    const stacks = owner.runtime.emberStacks || 0;
    if (stacks >= this.maxStacks) return;

    owner.runtime.emberStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} gains 1 Ember (${owner.runtime.emberStacks}/${this.maxStacks}).`,
    };
  },

  onBeforeDmgDealing({ attacker, owner, damage }) {
    if (attacker !== owner) return;
    const stacks = owner.runtime?.emberStacks || 0;
    if (stacks <= 0) return;

    return {
      damage: Number(damage) * (1 + (this.dmgPerStackPercent * stacks) / 100),
    };
  },
};
