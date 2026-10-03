import { elementsOf } from "../elements.js";

// ============================================================================
// AFFINITY SYSTEM
// ============================================================================

const ELEMENTAL_MATRIX = {
  steel: {
    weakTo: ["fire"],
    resists: ["steel", "air", "ice"],
  },

  earth: {
    weakTo: ["water"],
    resists: ["earth", "lightning", "fire"],
  },

  fire: {
    weakTo: ["water", "earth"],
    resists: ["fire", "ice", "air"],
  },

  water: {
    weakTo: ["lightning", "ice"],
    resists: ["water", "fire"],
  },

  lightning: {
    weakTo: ["earth"],
    resists: ["lightning", "air"],
  },

  air: {
    weakTo: ["fire", "ice"],
    resists: ["air", "earth"],
  },

  ice: {
    weakTo: ["fire", "steel"],
    resists: ["ice", "water"],
  },

  poison: {
    weakTo: ["fire", "water"],
    resists: ["poison", "plant", "earth"],
  },

  plant: {
    weakTo: ["fire", "poison"],
    resists: ["plant", "water", "earth"],
  },
};

const WEAK_FACTOR = 1.675;
const RESIST_FACTOR = 0.6;
// Weaknesses and resistances cancel one-for-one; the net saturates at +/-2.
const MAX_NET_AFFINITY = 2;

function applyAffinity(event, debugMode) {
  // A hit may carry several elements; each one is checked against every
  // defender affinity and the counts add up before the net cap applies.
  const skillElements = elementsOf(event.element);

  if (!skillElements.length) return;

  const defenderElements = event.defender?.elementalAffinities || [];
  if (!defenderElements.length) return;

  if (debugMode) {
    console.log("🔥 _applyAffinity chamado:", {
      skillElements,
      defender: event.defender.name,
      affinities: event.defender.elementalAffinities,
      damage: event.damage,
    });
  }

  const ignoresResistance =
    event.ignoreAffinityResistance && event.damageDepth === 0;

  let weakCount = 0;
  let resistCount = 0;

  for (const defEl of defenderElements) {
    const relation = ELEMENTAL_MATRIX[defEl];

    if (!relation) continue;

    for (const skillElement of skillElements) {
      if (relation.weakTo?.includes(skillElement)) {
        weakCount++;
      }

      if (!ignoresResistance && relation.resists?.includes(skillElement)) {
        resistCount++;
      }
    }
  }

  const net = Math.max(
    -MAX_NET_AFFINITY,
    Math.min(MAX_NET_AFFINITY, weakCount - resistCount),
  );
  if (net === 0) return;

  const multiplier = net > 0 ? WEAK_FACTOR ** net : RESIST_FACTOR ** -net;

  event.damage *= multiplier;
  if (net > 0) {
    event.affinityDialog = {
      message:
        net === MAX_NET_AFFINITY
          ? { en: "💥 It's DEVASTATING!", pt: "💥 É DEVASTADOR!" }
          : { en: "✨ It's SUPER EFFECTIVE!", pt: "✨ É SUPER EFETIVO!" },
      duration: 1000,
      timing: "post",
    };
  } else {
    event.affinityDialog = {
      message:
        net === -MAX_NET_AFFINITY
          ? { en: "🛡️ It barely has any effect...", pt: "🛡️ Quase não faz efeito..." }
          : { en: "🛡️ It's not very effective...", pt: "🛡️ Não é muito efetivo..." },
      duration: 1000,
      timing: "post",
    };
  }

  if (debugMode) {
    console.log("🔥 applyAffinity RESULT:", {
      skillElements,
      defender: event.defender.name,
      multiplier,
      weakCount,
      resistCount,
      finalDamage: event.damage,
    });
  }
}

// ============================================================================
// CRIT SYSTEM
// ============================================================================

const DEFAULT_CRIT_BONUS = 60;
const MAX_CRIT_CHANCE = 95;

function processCrit(event, debugMode) {
  if (debugMode) {
    console.group(`⚔️ [CRIT PROCESSING] - Damage Base: ${event.damage}`);
  }

  // extraChance adds to the attacker's Critical before the cap, in the same roll.
  const chance = Math.min(
    (event.attacker?.Critical || 0) + (event.critOptions?.extraChance || 0),
    MAX_CRIT_CHANCE,
  );

  event.crit = {
    chance,
    didCrit: false,
    bonus: 0,
    roll: null,
    forced: false,
  };

  // Rolled even at 0% chance, so editMode.alwaysCrit reaches attackers with no
  // Critical stat.
  Object.assign(
    event.crit,
    _rollCrit(
      event.attacker,
      event.context,
      chance,
      event.critOptions,
      debugMode,
    ),
  );

  const critBonusFactor = event.crit.bonus / 100;
  const critExtra = event.damage * critBonusFactor;

  event.crit.critBonusFactor = critBonusFactor;
  event.crit.critExtra = critExtra;
  if (debugMode) {
    console.log(
      `[DAMAGE COMPOSITION] 💥 Crit extra damage: ${critExtra.toFixed(2)}`,
    );
  }

  if (debugMode) console.groupEnd();
}

/** The % a crit adds for this attacker: its override when set (0 included), else the default. */
export function critBonusOf(attacker) {
  return attacker?.critBonusOverride ?? DEFAULT_CRIT_BONUS;
}

function _rollCrit(user, context, chance, critOptions = {}, debugMode = false) {
  const { force = false, disable = false } = critOptions;

  const bonus = critBonusOf(user);

  if (disable) {
    return {
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
      disabled: true,
    };
  }

  if (force) {
    return {
      didCrit: true,
      bonus,
      roll: null,
      forced: true,
      disabled: false,
    };
  }

  const roll = Math.random() * 100;

  const didCrit = context?.editMode?.alwaysCrit ? true : roll < chance;

  if (debugMode) {
    console.log(`[CRIT]🎯 Roll: ${roll.toFixed(2)}`);
    console.log(`[CRIT]🎲 Chance needed: ${chance}%`);
    console.log(didCrit ? "[CRIT]✅ CRITICAL!" : "[CRIT]❌ No crit");
    console.log(`[CRIT]➕ Crit bonus: ${bonus}%`);
  }

  return {
    didCrit,
    bonus: didCrit ? bonus : 0,
    roll,
    forced: false,
    disabled: false,
  };
}

// ============================================================================
// MODIFIER SYSTEM
// ============================================================================

function applyDamageModifiers(event, debugMode) {
  if (!event.attacker?.getDamageModifiers) {
    if (debugMode) {
      console.log(`⚠️ [DAMAGEMODIFIERS] No damage modifiers available`);
    }
    return;
  }

  if (debugMode) {
    console.group(`🔧 [DAMAGE MODIFIERS]`);
    console.log(`📍 Initial damage: ${event.damage}`);
  }

  event.attacker.purgeExpiredModifiers(event.context.currentTurn);

  const modifiers = event.attacker.getDamageModifiers();

  if (!Array.isArray(modifiers)) {
    throw new Error(
      `getDamageModifiers must return an array, got: ${modifiers}`,
    );
  }
  if (debugMode) {
    console.log(
      `[DAMAGE MODIFIERS] 🎯 Modifier count: ${modifiers.length}`,
    );
  }



  for (let i = 0; i < modifiers.length; i++) {
    const mod = modifiers[i];

    if (debugMode) {
      console.log(
        `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${event.damage}`,
      );
    }

    if (mod.apply) {
      const oldDamage = event.damage;

      const out = mod.apply(
        {
          baseDamage: event.damage,
          attacker: event.attacker,
          defender: event.defender,
          skill: event.skill,
          hitId: event.hitId,
        },
        event.context,
      );

      if (typeof out === "number") {
        event.damage = out;

        if (debugMode) {
          console.log(
            `     ✏️ Applied: ${oldDamage} → ${event.damage} (Δ ${event.damage - oldDamage})`,
          );
        }
      }
    }
  }

  if (debugMode) {
    console.log(`📊 Final damage: ${event.damage.toFixed(2)}`);
    console.groupEnd();
  }
}

// ============================================================================
// MAIN PIPELINE STEP
// ============================================================================

export function prepareDamage(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;
  const debug = event.constructor.debugMode;
  // Order matters:
  // crit -> modifiers -> affinity
  processCrit(event, debug);

  applyDamageModifiers(event, debug);

  applyAffinity(event, debug);
}
