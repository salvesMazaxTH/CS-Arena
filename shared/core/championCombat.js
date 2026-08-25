import { formatChampionName } from "../ui/formatters.js";
import { emitCombatEvent } from "../engine/combat/combatEvents.js";

export function roundToFive(x) {
  return Math.round(x / 5) * 5;
}

/** Push a shield onto the champion's runtime. type: "regular" | "spell" | "supreme". */
export function addShield(
  champion,
  amount,
  decayPerTurn = 0,
  context,
  type = "regular",
  extra = {},
) {
  champion.runtime.shields.push({
    amount,
    decayPerTurn,
    type,
    ...extra,
  });

  if (context?.registerShield) {
    context.registerShield({ target: champion, amount });
  }
}

// Decays shields at the start of a turn. Two expiry modes: gradual
// (decayPerTurn > 0, reduced each turn) and instant-at-end (expiresAtTurn set,
// dropped whole once reached, checked first). Shields with neither are permanent.
export function decayShields(champion, currentTurn) {
  if (
    !Array.isArray(champion.runtime?.shields) ||
    !champion.runtime.shields.length
  ) {
    return 0;
  }

  let removed = 0;

  champion.runtime.shields = champion.runtime.shields
    .map((shield) => {
      if (!shield) return null;

      // Instant-at-end: shield stays whole until duration expires, then drops entirely.
      if (shield.expiresAtTurn != null && currentTurn != null) {
        if (currentTurn >= shield.expiresAtTurn) {
          removed += 1;
          return null;
        }
        // Not yet expired — skip gradual decay for this shield.
        return shield;
      }

      // Gradual decay: reduce shield amount by decayPerTurn each turn.
      const amount = Number(shield.amount) || 0;
      const decayPerTurn = Number(shield.decayPerTurn) || 0;

      // Already depleted (e.g. fully absorbed a hit) — prune regardless of decay config.
      if (amount <= 0) {
        removed += 1;
        return null;
      }

      if (decayPerTurn <= 0) {
        return shield;
      }

      const nextAmount = amount - decayPerTurn;

      if (nextAmount <= 0) {
        removed += 1;
        return null;
      }

      return {
        ...shield,
        amount: nextAmount,
      };
    })
    .filter(Boolean);

  return removed;
}

/** Whether a shield blocks (and is consumed by) the current action. */
export function _checkAndConsumeShieldBlock(champion, context, damageType) {
  if (!Array.isArray(champion.runtime?.shields)) return false;

  // Supreme shield: blocks ANY action.
  const supremeIdx = champion.runtime.shields.findIndex(
    (s) => s.type === "supreme" && s.amount > 0,
  );
  if (supremeIdx !== -1) {
    champion.runtime.shields.splice(supremeIdx, 1);
    return true;
  }

  // Spell shield: blocks magical damage only.
  if (damageType === "magical") {
    const spellIdx = champion.runtime.shields.findIndex(
      (s) => s.type === "spell" && s.amount > 0,
    );
    if (spellIdx !== -1) {
      champion.runtime.shields.splice(spellIdx, 1);
      return true;
    }
  }

  return false;
}

/** Apply a taunt from taunterId to the champion, lasting `duration` turns. */
export function applyTaunt(champion, taunterId, duration, context) {
  champion.tauntEffects.push({
    taunterId: taunterId,
    expiresAtTurn: context.currentTurn + duration,
  });
  // Engine-level log and dialog
  const tauntSource = context?.allChampions?.get?.(taunterId);

  const tauntSourceName = tauntSource
    ? formatChampionName(tauntSource)
    : taunterId;

  const logMsg = `${formatChampionName(champion)} was taunted by <b>${tauntSourceName}</b>.`;

  if (context?.registerDialog) {
    context.registerDialog({
      message: logMsg,
      sourceId: taunterId,
      targetId: champion.id,
    });
  }
  return {
    log: logMsg,
    taunterId,
    targetId: champion.id,
    type: "tauntApply",
  };
}

/** Whether the champion is currently taunted by taunterId. */
export function isTauntedBy(champion, taunterId) {
  return champion.tauntEffects.some((effect) => effect.taunterId === taunterId);
}

/** Add a damage-reduction modifier. config.type: "flat" | "percent". Requires context. */
export function applyDamageReduction(champion, config = {}) {
  const {
    amount = 0,
    duration = 0,
    type = "flat",
    source = "unknown",
    context,
  } = config;

  if (!context) {
    throw new Error(
      `[applyDamageReduction] called without context (champion: ${champion?.name})`,
    );
  }

  champion.damageReductionModifiers.push({
    amount: amount,
    expiresAtTurn: context.currentTurn + duration,
    type: type,
    source: source,
  });
  console.log(
    `[Champion] ${champion.name} gained ${amount} damage reduction from ${source}. Will expire at turn ${context.currentTurn + duration}.`,
  );
}

/** Sum active damage reduction as { flat, percent }; pass currentTurn to skip expired. */
export function getTotalDamageReduction(champion, currentTurn) {
  let flat = 0;
  let percent = 0;

  for (const mod of champion.damageReductionModifiers) {
    // Skip expired modifiers if currentTurn is provided
    if (currentTurn !== undefined && mod.expiresAtTurn <= currentTurn) {
      continue;
    }

    if (mod.type === "percent") {
      percent += mod.amount;
    } else {
      flat += mod.amount;
    }
  }

  return { flat, percent };
}

// Per-stat floor and ceiling. Both the clamp on the way in and the recompute
// that runs when a modifier expires read this, so they can never disagree.
const STAT_LIMITS = {
  Critical: { min: 0, max: 95 },
  Evasion: { min: 0, max: 75 },
  default: { min: 10, max: 999 },
};

const statLimitsFor = (statName) => STAT_LIMITS[statName] || STAT_LIMITS.default;

/** Core stat mutation: rounds, clamps to per-stat limits, records the modifier. */
export function applyStatModifier(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    ignoreMinimum = false,
    statModifierSrc = undefined,
  } = {},
) {
  if (!(statName in champion)) {
    throw new Error(`Attempt to modify a non-existent stat: ${statName}`);
  }

  if (!Number.isFinite(amount)) {
    throw new Error(
      `[applyStatModifier] invalid amount for ${statName}: ${amount}`,
    );
  }

  if (
    statName === "Critical" ||
    statName === "Evasion" ||
    statName === "LifeSteal"
  ) {
    amount = Math.ceil(amount);
  } else {
    amount = roundToFive(amount);
  }

  const { min, max } = statLimitsFor(statName);

  const previous = champion[statName];
  const effectiveMin = ignoreMinimum ? 0 : min;
  const clamped = Math.max(effectiveMin, Math.min(previous + amount, max));
  const appliedAmount = clamped - previous;

  champion[statName] = clamped;

  const isCappedMax = amount > 0 && appliedAmount === 0;
  const capLog = isCappedMax ? `Stat ${statName} is already at maximum.` : null;

  const currentTurn = context?.currentTurn ?? 0;

  if (amount !== 0) {
    champion.statModifiers.push({
      statName: statName,
      amount: amount,
      ignoreMinimum: ignoreMinimum,
      expiresAtTurn: currentTurn + duration,
      isPermanent: isPermanent,
    });
  }

  if (appliedAmount !== 0 && context?.registerBuff) {
    // Fallback: default statModifierSrc to the champion itself.
    const src = statModifierSrc !== undefined ? statModifierSrc : champion;
    const resolvedSourceId = _resolveStatModifierSrcId({
      champion,
      context,
      statModifierSrc: src,
      appliedAmount,
    });

    context.registerBuff({
      target: champion,
      amount: appliedAmount,
      statName,
      sourceId: resolvedSourceId,
    });
  }

  return {
    appliedAmount,
    isCappedMax,
    log: capLog,
  };
}

// Shared body for buffStat/debuffStat: guards the stat, scales percent-based
// amounts against the base value, and forwards to applyStatModifier. Buff and
// debuff differ only in the sign of the incoming amount.
function _applyStatChange(champion, config, rawAmount) {
  const {
    statName,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
    ignoreMinimum = false,
    statModifierSrc = undefined,
  } = config;

  if (!(statName in champion)) {
    console.warn(`Attempt to modify a non-existent stat: ${statName}`);
    return;
  }

  let effectiveAmount = rawAmount;

  if (isPercent) {
    const usesBase = statName !== "HP" && statName !== "maxHP";
    const baseValue = usesBase ? champion[`base${statName}`] : champion[statName];
    const percentBase = Number.isFinite(baseValue)
      ? baseValue
      : Number.isFinite(champion[statName])
        ? champion[statName]
        : 0;

    effectiveAmount = (percentBase * rawAmount) / 100;
  }

  return applyStatModifier(champion, {
    statName,
    amount: effectiveAmount,
    duration,
    context,
    isPermanent,
    ignoreMinimum,
    statModifierSrc,
  });
}

/** Buff a stat; the amount is coerced positive. */
export function buffStat(champion, config = {}) {
  return _applyStatChange(
    champion,
    config,
    Math.abs(Number(config.amount) || 0),
  );
}

/** Debuff a stat; the amount is kept as given (typically negative). */
export function debuffStat(champion, config = {}) {
  return _applyStatChange(champion, config, config.amount);
}

/** Modify a stat, dispatching to buff or debuff based on the sign of amount. */
export function modifyStat(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
    ignoreMinimum = false,
    statModifierSrc,
  } = {},
) {
  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

  if (amount > 0) {
    // For buffs, default statModifierSrc to the champion itself.
    return buffStat(champion, {
      statName,
      amount,
      duration,
      context,
      isPermanent,
      isPercent,
      ignoreMinimum,
      statModifierSrc:
        statModifierSrc !== undefined ? statModifierSrc : champion,
    });
  }

  // Debuffs require an explicit statModifierSrc or context.statModifierSrcId.
  if (!statModifierSrc && !context?.statModifierSrcId) {
    throw new Error(
      `[modifyStat] Debuff on ${champion?.name ?? "unknown"} requires an explicit statModifierSrc or context.statModifierSrcId`,
    );
  }

  return debuffStat(champion, {
    statName,
    amount,
    duration,
    context,
    isPermanent,
    isPercent,
    ignoreMinimum,
    statModifierSrc,
  });
}

function _resolveStatModifierSrcId({
  champion,
  context,
  statModifierSrc,
  appliedAmount,
}) {
  if (statModifierSrc && typeof statModifierSrc === "object") {
    return statModifierSrc.id;
  }

  if (
    typeof statModifierSrc === "string" ||
    typeof statModifierSrc === "number"
  ) {
    return statModifierSrc;
  }

  if (appliedAmount > 0) {
    return context?.statModifierSrcId || champion?.id;
  }

  if (context?.statModifierSrcId) {
    return context.statModifierSrcId;
  }

  throw new Error(
    `[modifyStat] Debuff on ${champion?.name ?? "unknown"} requires an explicit statModifierSrc or context.statModifierSrcId`,
  );
}

/** Modify HP: current HP (damage/heal), or maxHP structurally via affectMax/maxHPOnly. */
export function modifyHP(
  champion,
  amount,
  {
    duration = 1,
    context,
    isPermanent = false,
    maxHPOnly = false,
    affectMax = false,
  } = {},
) {
  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

  amount = Math.floor(amount);

  // Proportional structural change (a true max-HP buff).
  if (affectMax) {
    const previousHP = champion.HP;

    const result =
      amount > 0
        ? buffStat(champion, {
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          })
        : debuffStat(champion, {
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          });

    // Apply the same delta to current HP.
    const nextHP = previousHP + result.appliedAmount;
    champion.HP = Math.max(0, Math.min(nextHP, champion.maxHP));

    return result;
  }
  // Change only the ceiling, without a proportional shift.
  if (maxHPOnly) {
    return amount > 0
      ? buffStat(champion, {
          statName: "maxHP",
          amount,
          duration,
          context,
          isPermanent,
        })
      : debuffStat(champion, {
          statName: "maxHP",
          amount,
          duration,
          context,
          isPermanent,
        });
  }

  // Current HP (heal/damage).
  if (amount > 0) {
    heal(champion, amount, context);
  } else {
    const previous = champion.HP;
    const newHP = Math.max(0, previous + amount);
    champion.HP = Math.floor(newHP);
  }

  return {
    appliedAmount: amount,
    isCappedMax: false,
    log: null,
  };
}

/** Apply raw damage, letting regular shields absorb first, then reducing HP. */
export function takeDamage(champion, amount, context) {
  if (!champion.alive) return;

  amount = Math.floor(amount);

  for (const shield of champion.runtime.shields) {
    // Spell and Supreme shields don't absorb HP — they only block actions.
    if (shield.type && shield.type !== "regular") continue;
    if (amount <= 0) break;

    const absorbed = Math.min(shield.amount, amount);
    shield.amount -= absorbed;
    amount -= absorbed;
  }

  champion.HP -= amount;

  if (champion.HP <= 0) {
    champion.HP = 0;
    champion.alive = false;
  }
}

/** Heal the champion, running onBeforeHealing hooks; returns the amount actually healed. */
export function heal(
  champion,
  amount,
  context,
  source = champion,
  options = {},
) {
  if (!champion.alive) return 0;

  const ctx = context || champion.runtime?.currentContext;

  const payload = {
    source,
    target: champion,
    amount,

    context: ctx,

    healType: options?.type || "normal",
    isLifesteal: options?.type === "lifesteal",

    fromTargetId: options?.fromTargetId ?? null,
  };

  // Normalize the initial value before hooks run.
  if (payload.amount > 0) {
    payload.amount = Math.max(Math.floor(payload.amount), 1);
  }

  // Let hooks modify the heal before it lands.
  const beforeResults =
    emitCombatEvent("onBeforeHealing", payload, ctx?.allChampions) || [];

  for (const result of beforeResults) {
    if (!result) continue;

    // Explicit override of the final heal value.
    if (typeof result.amount === "number") {
      payload.amount = result.amount;
    }
  }

  // Safety clamp after modifications.
  payload.amount = Math.max(0, Math.floor(payload.amount));

  amount = payload.amount;

  const before = champion.HP;

  champion.HP = Math.min(champion.HP + amount, champion.maxHP);

  const healed = Math.max(0, champion.HP - before);

  if (healed <= 0) return 0;

  const isLifesteal = options?.type === "lifesteal";

  if (isLifesteal && ctx?.registerLifesteal) {
    ctx.registerLifesteal({
      target: champion,
      amount: healed,
      sourceId: source?.id,
      fromTargetId: options?.fromTargetId ?? null,
    });
  } else if (ctx?.registerHeal) {
    ctx.registerHeal({
      target: champion,
      amount: healed,
      sourceId: source?.id,
    });
  }

  return healed;
}

/** Drop expired stat modifiers, recompute affected stats from base; returns reverted stats. */
export function purgeExpiredStatModifiers(champion, currentTurn) {
  const affectedStats = new Set();
  const remaining = [];

  for (const modifier of champion.statModifiers) {
    if (modifier.expiresAtTurn <= currentTurn && !modifier.isPermanent) {
      affectedStats.add(modifier.statName);
    } else {
      remaining.push(modifier);
    }
  }

  champion.statModifiers = remaining;

  const revertedStats = _recomputeStats(champion, remaining, affectedStats);

  champion.tauntEffects = champion.tauntEffects.filter(
    (effect) => effect.expiresAtTurn > currentTurn,
  );

  champion.damageReductionModifiers = champion.damageReductionModifiers.filter(
    (modifier) => modifier.expiresAtTurn > currentTurn,
  );

  return revertedStats;
}

export function revertStatModifiersFromStatus(champion, statusKey) {
  const affectedStats = new Set();
  const remaining = [];

  for (const modifier of champion.statModifiers) {
    if (modifier.statusKey === statusKey) {
      affectedStats.add(modifier.statName);
    } else {
      remaining.push(modifier);
    }
  }

  champion.statModifiers = remaining;

  return _recomputeStats(champion, remaining, affectedStats);
}

function _recomputeStats(champion, remaining, affectedStats) {
  const revertedStats = [];

  for (const statName of affectedStats) {
    const baseKey = statName === "maxHP" ? "baseHP" : `base${statName}`;
    const baseValue = champion[baseKey];
    if (baseValue === undefined) continue;

    const { max } = statLimitsFor(statName);

    const previousValue = champion[statName];
    let newValue = baseValue;

    for (const mod of remaining) {
      if (mod.statName === statName) {
        const effectiveMin = mod.ignoreMinimum ? 0 : statLimitsFor(statName).min;
        newValue = Math.max(effectiveMin, Math.min(newValue + mod.amount, max));
      }
    }

    champion[statName] = newValue;

    if (statName === "maxHP") {
      champion.HP = Math.max(0, Math.min(champion.HP, champion.maxHP));
    }

    if (previousValue !== newValue) {
      revertedStats.push({
        championId: champion.id,
        statName: statName,
        revertedAmount: newValue - previousValue,
        newValue: newValue,
      });
    }
  }

  return revertedStats;
}

/** Append a damage modifier to the champion. */
export function addDamageModifier(champion, mod) {
  champion.damageModifiers.push(mod);
}

/** Drop expired (non-permanent) damage modifiers. */
export function purgeExpiredModifiers(champion, currentTurn) {
  champion.damageModifiers = champion.damageModifiers.filter((m) => {
    if (m.permanent) return true;
    return m.expiresAtTurn > currentTurn;
  });
}

/** Drop expired runtime hook effects (those past their expiresAtTurn). */
export function purgeExpiredHookEffects(champion, currentTurn) {
  if (!Array.isArray(champion.runtime?.hookEffects)) return;

  champion.runtime.hookEffects = champion.runtime.hookEffects.filter(
    (effect) =>
      effect?.expiresAtTurn === undefined || effect.expiresAtTurn > currentTurn,
  );
}

/** All damage modifiers on the champion (empty array if none). */
export function getDamageModifiers(champion) {
  return champion.damageModifiers || [];
}
