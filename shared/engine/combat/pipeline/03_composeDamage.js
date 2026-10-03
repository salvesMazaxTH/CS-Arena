// ============================================================================
// DEFENSE SYSTEM
// ============================================================================

const MIN_DAMAGE_FLOOR = 5;

const MAX_REDUCTION = 0.95;

// Defense -> damage reduction, as [defense, reduction] points sorted by
// defense and linearly interpolated between them. Built once at load.
const DEFENSE_CURVE = [
  [0, 0.0],
  [35, 0.25],
  [60, 0.4],
  [85, 0.53],
  [110, 0.6],
  [125, 0.633],
  [150, 0.68],
  [175, 0.72],
  [200, 0.754],
  [220, 0.78],
  [300, 0.85],
  [400, 0.9],
  [600, MAX_REDUCTION],
];

function defToMitPct(defense, debugMode) {
  let effective = MAX_REDUCTION;

  if (!(defense > 0)) {
    effective = 0;
  } else {
    for (let i = 1; i < DEFENSE_CURVE.length; i++) {
      const [b, rb] = DEFENSE_CURVE[i];
      if (defense <= b) {
        const [a, ra] = DEFENSE_CURVE[i - 1];
        effective = ra + ((defense - a) / (b - a)) * (rb - ra);
        break;
      }
    }
  }

  if (debugMode) {
    console.log(
      `🛡️ Defense ${defense} -> ${(effective * 100).toFixed(2)}% reduction`,
    );
  }

  return effective;
}

// ============================================================================
// MAIN PIPELINE STEP
// ============================================================================

export function composeDamage(event) {
  if (event.constructor.debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);

  if (typeof event.damage !== "number") {
    throw new Error(`composeDamage received invalid damage: ${event.damage}`);
  }

  // Snapshot of the peak damage before the target defends.
  event.preMitigationDamage = event.damage;
  if (event.constructor.debugMode) {
    console.log(
      `📸 Pre-mitigation damage: ${event.preMitigationDamage.toFixed(2)}`,
    );
  }

  // What Defense and damage reduction took off the hit. A recompose starts
  // over, so it is reset here rather than accumulated.
  event.mitigatedDamage = 0;

  // Crit is rolled only on non-Absolute hits (step 2), but a hit that already
  // crit keeps it when a step 4 hook promotes it to Absolute. critExtra is
  // recomputed from the current bonus, which a hook may have changed.
  if (event.crit.didCrit) {
    event.crit.critExtra = event.damage * (event.crit.bonus / 100);
    event.damage += event.crit.critExtra;
  }

  // Absolute damage skips the whole mitigation body; every other mode runs it.
  if (event.mode !== event.constructor.Modes.ABSOLUTE) {
    const damageBeforeMitigation = event.damage;

    const baseDefense = event.defender.baseDefense ?? event.defender.Defense;
    const currentDefense = event.defender.Defense;

    const defenseUsed = event.crit.didCrit
      ? Math.min(baseDefense, currentDefense)
      : currentDefense;

    let flat = 0;
    let percent = 0;

    if (!event.ignoreDamageReduction) {
      const tr = event.defender.getTotalDamageReduction?.(
        event.context?.currentTurn,
      ) || {
        flat: 0,
        percent: 0,
      };
      flat = tr.flat || 0;
      percent = tr.percent || 0;
    }

    // STANDARD is PIERCING that ignores 0% of the Defense.
    let piercePct = 0;
    if (event.mode === event.constructor.Modes.PIERCING) {
      piercePct = Math.min(100, Math.max(0, Number(event.piercingPercentage) || 0));
    }

    const defensePercent = defToMitPct(
      defenseUsed * (1 - piercePct / 100),
      event.constructor.debugMode,
    );
    event.damage -= event.damage * defensePercent;
    event.damage *= 1 - percent / 100;
    event.damage -= flat;

    event.mitigatedDamage = Math.max(0, damageBeforeMitigation - event.damage);
  }

  // Semi-absolute bonus rider: joins the hit after mitigation.
  if (event.bonusDamage > 0) event.damage += event.bonusDamage;

  // -------- FLOOR --------
  // Lifts only a total below the floor; it never stacks on top of the rider.
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    event.damage < MIN_DAMAGE_FLOOR
  ) {
    // What the floor gives back was never mitigated.
    const lift = MIN_DAMAGE_FLOOR - event.damage;
    event.mitigatedDamage = Math.max(0, event.mitigatedDamage - lift);
    event.damage = MIN_DAMAGE_FLOOR;
  }

  // Snapshot of the final computed damage, ready to apply.

  const damageOverride = event.context?.editMode?.damageOutput;

  if (damageOverride != null) {
    event.damage = damageOverride;
  }

  if (event.constructor.debugMode) {
    console.log(`[DAMAGE COMPOSITION] 📈 Final: ${event.damage.toFixed(2)}`);
    console.groupEnd();
  }
}
