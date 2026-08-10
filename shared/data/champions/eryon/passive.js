import { formatChampionName } from "../../../ui/formatters.js";

function _processResonance(owner, threshold, momentumGain, context, resolver) {
  let procs = 0;

  while ((owner.runtime.ressonanceStacks || 0) >= threshold) {
    const ally = context.aliveChampions
      .filter((c) => c.team === owner.team && c.id !== owner.id)
      .sort((a, b) => a.momentum - b.momentum)[0];

    if (!ally) break;

    owner.runtime.ressonanceStacks -= threshold;

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
  key: "ressonancia_eryonica",
  name: "Ressonância Eryônica",
  stacksCap: 20,
  momentumGain: 4,

  description(champion) {
    const stacks = champion.runtime.ressonanceStacks || 0;

    return `Sempre que um aliado ganha ou consome Momentum, Eryon acumula Ressonância.

    <b>Acúmulos atuais: ${stacks}</b>

    A cada ${this.stacksCap} unidades acumuladas, concede ${this.momentumGain} Momentum ao aliado com menor Momentum.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.ressonanceStacks ??= 0;
    owner.runtime.ressonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.momentumGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
          owner,
        )} converteu Ressonância ${procs}x. Acúmulos restantes: ${
          owner.runtime.ressonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
        owner,
      )} acumulou ${amount} de Ressonância. Acúmulos atuais: ${
        owner.runtime.ressonanceStacks
      }`,
    };
  },

  onResourceSpend({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.ressonanceStacks ??= 0;
    owner.runtime.ressonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.momentumGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
          owner,
        )} converteu Ressonância ${procs}x. Acúmulos restantes: ${
          owner.runtime.ressonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
        owner,
      )} acumulou ${amount} de Ressonância. Acúmulos atuais: ${
        owner.runtime.ressonanceStacks
      }`,
    };
  },
};
