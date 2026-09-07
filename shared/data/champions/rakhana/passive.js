import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "silver_flow",
  name: "Silver Flow",

  maxStacks: 3,
  absoluteBonusPercent: 25,

  description(champion) {
    const stacks = champion.runtime?.silverFlowStacks || 0;

    return `Whenever Rakhana deals damage to an enemy, she gains 1 <b>Flow</b> stack (Max: ${this.maxStacks}).

    At ${this.maxStacks} stacks, her next attack consumes all Flow: it lands as <b>Absolute Damage</b> for ${this.absoluteBonusPercent}% more than the hit would otherwise deal through the target's defenses.

    <b>Current Flow: ${stacks}/${this.maxStacks}</b>`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, defender, damage }) {
    if (damage <= 0 || defender.team === owner.team) return;

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

  onBeforeDmgDealing({ owner, damage, bonusDamage }) {
    const stacks = owner.runtime?.silverFlowStacks || 0;

    if (stacks < this.maxStacks) return;

    owner.runtime.silverFlowStacks = 0;

    // `damage` is already past the target's defenses and includes any bonusDamage
    // rider, which is unreducible on its own and is re-added in composeDamage.
    // Amplify only the mitigated part, then pin preMitigationDamage so the
    // recompose keeps exactly this figure.
    const rider = bonusDamage || 0;
    const amplified = (damage - rider) * (1 + this.absoluteBonusPercent / 100);

    return {
      mode: "absolute",
      baseDamage: amplified,
      preMitigationDamage: amplified,
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} releases her accumulated Flow — the blow lands whole, ${this.absoluteBonusPercent}% past what the target's defenses would have spared.`,
    };
  },
};