export default {
  key: "silver_flow",
  name: "Silver Flow",

  maxStacks: 3,
  damageConversionPercent: 0.70,
  bonusAbsoluteDamage: 30,

  description(champion) {
    const stacks = champion.runtime?.silverFlowStacks || 0;

    return `Whenever Rakhana deals damage to an enemy, she gains 1 <b>Flow</b> stack (Max: ${this.maxStacks}).

    At 3 stacks, her next attack consumes all Flow, dealing ${this.damageConversionPercent * 100}% of its damage plus ${this.bonusAbsoluteDamage} bonus damage as <b>Absolute Damage</b>.

    <b>Current Flow: ${stacks}/${this.maxStacks}</b>`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, damage }) {
    if (damage <= 0) return;

    owner.runtime ??= {};

    const stacks = owner.runtime.silverFlowStacks || 0;

    if (stacks >= this.maxStacks) return;

    owner.runtime.silverFlowStacks = stacks + 1;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} gains 1 Flow (${owner.runtime.silverFlowStacks}/${this.maxStacks}).`,
    };
  },

  onBeforeDmgDealing({ owner, damage }) {
    const stacks = owner.runtime?.silverFlowStacks || 0;

    if (stacks < this.maxStacks) return;

    owner.runtime.silverFlowStacks = 0;

    const convertedDamage =
      damage * this.damageConversionPercent +
      this.bonusAbsoluteDamage;

    return {
      damage: convertedDamage,
      mode: "absolute",
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} releases her accumulated Flow, converting ${this.damageConversionPercent * 100}% of the attack's damage into Absolute Damage and adding ${this.bonusAbsoluteDamage} bonus Absolute Damage!`,
    };
  },
};