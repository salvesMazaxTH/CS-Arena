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
  const skillElements = elementsOf(event.element ?? event.skill?.element);

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
        net === MAX_NET_AFFINITY ? "💥 É DEVASTADOR!" : "✨ É SUPER-EFETIVO!",
      duration: 1000,
      timing: "post",
    };
  } else {
    event.affinityDialog = {
      message:
        net === -MAX_NET_AFFINITY
          ? "🛡️ Quase não faz efeito..."
          : "🛡️ Não é muito efetivo...",
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
    console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${event.damage}`);
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

  if (chance > 0 || event.critOptions?.force || event.critOptions?.disable) {
    const rolled = _rollCrit(
      event.attacker,
      event.context,
      chance,
      event.critOptions,
      debugMode,
    );

    if (rolled) Object.assign(event.crit, rolled);
  }

  const critBonusFactor = event.crit.bonus / 100;
  const critExtra = event.damage * critBonusFactor;

  event.crit.critBonusFactor = critBonusFactor;
  event.crit.critExtra = critExtra;
  if (debugMode) {
    console.log(
      `[DAMAGE COMPOSITION] 💥 Dano extra de crítico: ${critExtra.toFixed(2)}`,
    );
  }

  if (debugMode) console.groupEnd();
}

function _rollCrit(user, context, chance, critOptions = {}, debugMode = false) {
  const { force = false, disable = false } = critOptions;

  const bonus = user?.critBonusOverride || DEFAULT_CRIT_BONUS;

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
    console.log(`[CRIT]🎲 Chance necessária: ${chance}%`);
    console.log(didCrit ? "[CRIT]✅ CRÍTICO!" : "[CRIT]❌ Sem crítico");
    console.log(`[CRIT]➕ Bônus de crítico: ${bonus}%`);
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
      console.log(`⚠️ [DAMAGEMODIFIERS] Nenhum modificador de dano disponível`);
    }
    return;
  }

  if (debugMode) {
    console.group(`🔧 [DAMAGE MODIFIERS]`);
    console.log(`📍 Damage Inicial: ${event.damage}`);
  }

  event.attacker.purgeExpiredModifiers(event.context.currentTurn);

  const modifiers = event.attacker.getDamageModifiers();

  if (debugMode) {
    console.log(
      `[DAMAGE MODIFIERS] 🎯 Total de modificadores: ${modifiers.length}`,
    );
  }

  if (!Array.isArray(modifiers)) {
    throw new Error(
      `getDamageModifiers deve retornar um array, mas recebeu: ${modifiers}`,
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
            `     ✏️ Aplicado: ${oldDamage} → ${event.damage} (Δ ${event.damage - oldDamage})`,
          );
        }
      }
    }
  }

  if (debugMode) {
    console.log(`📊 Damage Final: ${event.damage.toFixed(2)}`);
    console.groupEnd();
  }
}

// ============================================================================
// MAIN PIPELINE STEP
// ============================================================================

export function prepareDamage(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;
  const debug = event.constructor.debugMode;
  // ordem importa
  // crit -> modifiers -> affinity
  processCrit(event, debug);

  applyDamageModifiers(event, debug);

  applyAffinity(event, debug);
}
