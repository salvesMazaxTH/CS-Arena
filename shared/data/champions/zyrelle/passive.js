import { formatChampionName } from "../../../ui/formatters.js";
import { MAX_AMMO, IDLE_RELOAD } from "./ammo.js";

export default {
  key: "loaded_odds",
  name: "Loaded Odds",

  aimBonus: 25,

  description(champion) {
    return `Zyrelle's revolver holds ${MAX_AMMO} rounds; every shot she fires spends one. If she ever runs dry, a turn spent not shooting lets her thumb ${IDLE_RELOAD} rounds back in.

    Every critical hit she lands sharpens her aim: +${this.aimBonus}% Critical on her very next shot. An already-guaranteed crit doesn't spend the charge.

    Rounds loaded: <b>${champion.runtime?.zyrelleAmmo ?? MAX_AMMO}/${MAX_AMMO}</b>`;
  },

  hookScope: {
    onCriticalHit: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onTurnEnd({ owner, context }) {
    if (context.currentTurn === owner.runtime.zyrelleLastFiredTurn) return;

    const before = owner.runtime.zyrelleAmmo ?? MAX_AMMO;
    owner.runtime.zyrelleAmmo = Math.min(MAX_AMMO, before + IDLE_RELOAD);

    if (owner.runtime.zyrelleAmmo === before) return;

    return {
      log: `<b>[Passive — Loaded Odds]</b> ${formatChampionName(owner)} didn't fire this turn and thumbs rounds back into the cylinder (${owner.runtime.zyrelleAmmo}/${MAX_AMMO}).`,
    };
  },

  // Deliberately bypasses the statModifiers/duration system: the bonus must
  // vanish after exactly one DamageEvent, not "after N turns", and a manual
  // grant/revert pair on the raw stat (same idiom as Tyren's Living Steel
  // Aegis) is the only way to guarantee that.
  onCriticalHit({ owner }) {
    if (owner.runtime.zyrelleAimCharged) return;

    const before = owner.Critical;
    owner.Critical = Math.min(95, before + this.aimBonus);
    const applied = owner.Critical - before;

    if (applied <= 0) return;

    owner.runtime.zyrelleAimCharged = applied;

    return {
      log: `<b>[Passive — Loaded Odds]</b> ${formatChampionName(owner)}'s aim sharpens: +${applied}% Critical on her next shot.`,
    };
  },

  onBeforeDmgDealing({ owner, crit }) {
    const charge = owner.runtime.zyrelleAimCharged;
    if (!charge) return;
    if (crit?.forced) return; // Banked charge survives a guaranteed crit.

    owner.runtime.zyrelleAimCharged = 0;
    owner.Critical = Math.max(0, owner.Critical - charge);
  },
};
