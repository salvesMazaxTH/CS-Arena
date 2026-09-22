import { formatChampionName } from "../../../ui/formatters.js";

const ABSORB_PERCENT = 40;
const UNREFINED_PER_MOMENTUM = 20;
const MOMENTUM_CAP_PER_TURN = 5;

// Shared with the Primordial form, which passes a higher percent.
export function unrefineMagical(
  { owner, attacker, defender, damage, type },
  percent,
) {
  if (defender !== owner || attacker === owner || type !== "magical") return;

  const absorbed = Math.floor(((Number(damage) || 0) * percent) / 100);
  if (absorbed <= 0) return;

  owner.runtime.maliUnrefined = (owner.runtime.maliUnrefined ?? 0) + absorbed;

  return { damage: Math.max(0, Number(damage) - absorbed) };
}

// `perTurnCap` is higher for the Primordial form. Bypasses applyResourceChange
// the same way Silas' passive does, so the caller announces it with a dialog.
export function drainUnrefined(owner, { perTurnCap }) {
  const pool = owner.runtime.maliUnrefined ?? 0;

  const gain = Math.min(perTurnCap, Math.floor(pool / UNREFINED_PER_MOMENTUM));
  if (gain <= 0) return 0;

  const applied = owner.addMomentum({ amount: gain });
  if (applied <= 0) return 0;

  owner.runtime.maliUnrefined = pool - applied * UNREFINED_PER_MOMENTUM;
  if (owner.runtime.maliUnrefined <= 0) delete owner.runtime.maliUnrefined;

  return applied;
}

export default {
  key: "older_than_refinement",
  name: "Older Than Refinement",

  absorbPercent: ABSORB_PERCENT,
  unrefinedPerMomentum: UNREFINED_PER_MOMENTUM,
  momentumCapPerTurn: MOMENTUM_CAP_PER_TURN,

  description(champion) {
    const pool = champion.runtime?.maliUnrefined ?? 0;

    return {
      en: `Mali Magarc was king of magic's essence in the age before anyone had learned to shape it, and every spell still slackens in his grip. Magic that would wound him is pulled back to the raw arcane it was refined from: <b>${this.absorbPercent}%</b> of incoming magical damage is unmade and pooled in him, and at the start of each turn every <b>${this.unrefinedPerMomentum}</b> points pooled become <b>1 Momentum</b>, up to <b>${this.momentumCapPerTurn}</b>.

    <b>Unrefined essence pooled: ${pool}</b>`,
      pt: `Mali Magarc foi rei da essência mágica numa era anterior a qualquer refinamento, e todo feitiço ainda amolece em seu punho. A magia que o feriria é puxada de volta ao arcano bruto de onde foi refinada: <b>${this.absorbPercent}%</b> do dano mágico recebido é desfeito e armazenado nele, e no início de cada turno cada <b>${this.unrefinedPerMomentum}</b> pontos armazenados viram <b>1 Momentum</b>, até o limite de <b>${this.momentumCapPerTurn}</b>.

    <b>Essência bruta armazenada: ${pool}</b>`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking(payload) {
    return unrefineMagical(payload, this.absorbPercent);
  },

  onTurnStart({ owner, context }) {
    const gained = drainUnrefined(owner, {
      perTurnCap: this.momentumCapPerTurn,
    });
    if (!gained) return;

    context?.registerDialog?.({
      message: {
        en: `<b>[Passive — ${this.name}]</b> the unmade magic settles in ${formatChampionName(owner)} as <b>${gained}</b> Momentum.`,
        pt: `<b>[Passivo — ${this.name}]</b> a magia desfeita se assenta em ${formatChampionName(owner)} como <b>${gained}</b> de Momentum.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} draws <b>${gained}</b> Momentum out of the pooled essence.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} extrai <b>${gained}</b> de Momentum da essência armazenada.`,
      },
    };
  },
};
