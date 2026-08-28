import { formatChampionName } from "../../../ui/formatters.js";

function onResourceChanged({ owner, target, amount, context, resolver }) {
  if (owner.team !== target.team) return;
  if (target.id === owner.id) return;
  if (amount <= 0) return;

  owner.runtime.resonanceStacks = Math.min(
    this.stacksCap,
    (owner.runtime.resonanceStacks ?? 0) + amount,
  );

  let converted = false;

  if (owner.runtime.resonanceStacks >= this.stacksCap) {
    const ally = context.aliveChampions
      .filter((c) => c.team === owner.team && c.id !== owner.id)
      .sort((a, b) => a.momentum - b.momentum)[0];

    if (ally) {
      owner.runtime.resonanceStacks -= this.stacksCap;

      resolver.applyResourceChange({
        target: ally,
        amount: this.momentumGain,
        context,
        sourceId: owner.id,
        debugLabel: "eryon_resonance_grant",
      });

      converted = true;
    }
  }

  const summary = converted
    ? `converted Resonance. Remaining stacks: ${owner.runtime.resonanceStacks}`
    : `gained ${amount} Resonance. Current stacks: ${owner.runtime.resonanceStacks}`;

  return {
    log: `<b>[PASSIVE — Eryonic Resonance]</b> ${formatChampionName(owner)} ${summary}`,
  };
}

export default {
  key: "eryonic_resonance",
  name: "Eryonic Resonance",

  stacksCap: 20,
  momentumGain: 4,

  description(champion) {
    const stacks = champion.runtime.resonanceStacks || 0;

    return `Whenever an ally gains or spends Momentum, Eryon gains Resonance.

    <b>Current Stacks: ${stacks}</b>

    At ${this.stacksCap} Resonance stacks, grants ${this.momentumGain} Momentum to the ally with the lowest Momentum.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain: onResourceChanged,
  onResourceSpend: onResourceChanged,
};
