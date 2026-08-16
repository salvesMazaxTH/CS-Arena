import { formatChampionName } from "../../../ui/formatters.js";

function _processResonance(owner, threshold, momentumGain, context, resolver) {
  let procs = 0;

  while ((owner.runtime.resonanceStacks || 0) >= threshold) {
    const ally = context.aliveChampions
      .filter((c) => c.team === owner.team && c.id !== owner.id)
      .sort((a, b) => a.momentum - b.momentum)[0];

    if (!ally) break;

    owner.runtime.resonanceStacks -= threshold;

    if (resolver?.applyResourceChange) {
      resolver.applyResourceChange({
        target: ally,
        amount: momentumGain,
        context,
        sourceId: owner.id,
        debugLabel: "eryon_resonance_grant",
      });
    } else {
      ally.addMomentum(momentumGain);
    }

    procs++;
  }

  return procs;
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

  onResourceGain({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.resonanceStacks ??= 0;
    owner.runtime.resonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.momentumGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVE — Eryonic Resonance]</b> ${formatChampionName(
          owner,
        )} converted Resonance ${procs}x. Remaining stacks: ${
          owner.runtime.resonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVE — Eryonic Resonance]</b> ${formatChampionName(
        owner,
      )} gained ${amount} Resonance. Current stacks: ${
        owner.runtime.resonanceStacks
      }`,
    };
  },

  onResourceSpend({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.resonanceStacks ??= 0;
    owner.runtime.resonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.momentumGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVE — Eryonic Resonance]</b> ${formatChampionName(
          owner,
        )} converted Resonance ${procs}x. Remaining stacks: ${
          owner.runtime.resonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVE — Eryonic Resonance]</b> ${formatChampionName(
        owner,
      )} gained ${amount} Resonance. Current stacks: ${
        owner.runtime.resonanceStacks
      }`,
    };
  },
};
