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

    return {
      en: `Eryon was raised among magi who never asked when something would happen — only which instant already belonged to it, and every stir of momentum around him rings on that ledger. Whenever an ally gains or spends <b>Momentum</b>, Eryon gains <b>Resonance</b>.

      <b>Current Stacks: ${stacks}</b>

      At <b>${this.stacksCap}</b> Resonance stacks, grants <b>${this.momentumGain}</b> Momentum to the ally with the lowest Momentum.`,
      pt: `Eryon foi criado entre magos que nunca perguntavam quando algo aconteceria — só a qual instante aquilo já pertencia, e cada oscilação de momentum ao seu redor ressoa nesse registro. Sempre que um aliado ganha ou gasta <b>Momentum</b>, Eryon ganha <b>Ressonância</b>.

      <b>Cargas Atuais: ${stacks}</b>

      Ao atingir <b>${this.stacksCap}</b> cargas de Ressonância, concede <b>${this.momentumGain}</b> de Momentum ao aliado com menos Momentum.`,
    };
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain: onResourceChanged,
  onResourceSpend: onResourceChanged,
};
