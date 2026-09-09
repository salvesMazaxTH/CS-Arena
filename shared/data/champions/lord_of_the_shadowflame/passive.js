import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "hunger_of_the_flame",
  name: "Hunger of the Flame",

  maxStacks: 5,
  dmgPerStackPercent: 4,
  minEmbersToSurvive: 2,
  survivalPercentPerEmber: 8,

  description(champion) {
    const stacks = champion.runtime?.emberStacks || 0;

    return `Every wound just feeds it. Whenever it takes damage, it gains 1 Ember stack (Max: ${this.maxStacks}), and each stack adds ${this.dmgPerStackPercent}% bonus damage to its own attacks. A blow that would put it out instead burns every Ember it holds and leaves it standing on up to ${this.survivalPercentPerEmber}% of its Max HP per Ember spent — but only from ${this.minEmbersToSurvive} Embers up, and never on the turn it took this shape.

    <b>Current Embers: ${stacks}/${this.maxStacks}</b>`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
      allowOnAbsolute: true,
    },
  },

  onBeforeDmgTaking({ owner, defender, damage, context }) {
    if (defender !== owner || !(damage > 0)) return;
    if (owner.runtime.shadowflameArrivedTurn === context.currentTurn) return;
    if (!owner.wouldBeLethal(damage)) return;

    const stacks = owner.runtime.emberStacks || 0;
    if (stacks < this.minEmbersToSurvive) return;

    owner.runtime.emberStacks = 0;

    const survivalHP = Math.round(
      (owner.maxHP * this.survivalPercentPerEmber * stacks) / 100,
    );

    context.registerDialog({
      message: `The Flame spends every Ember at once — ${formatChampionName(owner)} will not be put out.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: Math.max(
        owner.HP + regularShieldTotal(owner) - survivalHP,
        0,
      ),
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} burns ${stacks} Ember(s) to stay standing at ${survivalHP} HP.`,
    };
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
