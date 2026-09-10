import { formatChampionName } from "../../../ui/formatters.js";

const ABSORB_PERCENT = 40;
const UNREFINED_PER_MOMENTUM = 20;
const MOMENTUM_CAP_PER_TURN = 5;

// Strips a share of an incoming magical hit into raw arcane and pools it on the
// defender. Returns the damage patch for the hook to hand back, or nothing when
// there is nothing to strip. Shared with the Primordial form, which passes a
// higher percent.
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

// Pays out the pooled essence as Momentum, once at the start of a turn. Whatever
// the per-turn cap leaves behind stays pooled for the next turn. `perTurnCap` is
// higher for the Primordial form. Bypasses applyResourceChange the same way
// Silas' passive does, so the caller announces it with a dialog.
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

    return `Mali Magarc was king of magic's essence in the age before anyone had learned to shape it, and every spell still slackens in his grip. Magic that would wound him is pulled back to the raw arcane it was refined from: ${this.absorbPercent}% of incoming magical damage is unmade and pooled in him, and at the start of each turn every ${this.unrefinedPerMomentum} points pooled become 1 Momentum, up to ${this.momentumCapPerTurn}.

    <b>Unrefined essence pooled: ${pool}</b>`;
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
      message: `<b>[Passive — ${this.name}]</b> the unmade magic settles in ${formatChampionName(owner)} as ${gained} Momentum.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} draws ${gained} Momentum out of the pooled essence.`,
    };
  },
};
