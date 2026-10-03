import { formatChampionName } from "../../../ui/formatters.js";
import { emitCombatEvent } from "../combatEvents.js";
import { SpawnProtection } from "../spawnProtection.js";

export function preChecks(event) {
  const activeChampions = event?.context?.allChampions;

  if (
    !event?.defender?.id ||
    !event.defender.alive ||
    (activeChampions instanceof Map && !activeChampions.has(event.defender.id))
  ) {
    return _buildInactiveTargetResult(event);
  }

  // The target was on the field for this action, so its later absence needs no
  // explanation to a player who just watched it happen.
  event.context.dialogDedupeKeys.add(_inactiveDialogKey(event.defender.id));

  if (SpawnProtection.isActive(event.defender)) {
    return _buildUnreachableResult(event, null, { silent: true });
  }

  // 1️⃣ IMMUNITY
  const results = emitCombatEvent(
    "onDamageIncoming",
    {
      attacker: event.attacker,
      defender: event.defender,
      damage: event.damage,
      skill: event.skill,
      mode: event.mode,
      element: event.element,
      type: event.type,
      context: event.context,
    },
    event.allChampions,
  );

  let hookForcedEvade = null;

  for (const r of results) {
    if (r?.message) {
      event.context?.logs?.push?.(r.message);
    }

    // A defender-side hook may force the evade outright, not just roll for it.
    if (r?.evade) hookForcedEvade = r;

    if (r?.cancel) {
      return r.unreachable
        ? _buildUnreachableResult(event, r.message ?? null)
        : _buildImmuneResult(event, r.message ?? null);
    }

    if (r?.modifiedDamage !== undefined) {
      event.damage = r.modifiedDamage;
    }
  }

  // 2️⃣ EVASION
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.cannotBeEvaded
  ) {
    const evasion = hookForcedEvade
      ? { attempted: true, evaded: true }
      : _rollEvasion({
          defender: event.defender,
          context: event.context,
          debugMode: event.constructor.debugMode,
        });

    event.evasionAttempted = !!evasion?.attempted;

    if (evasion?.evaded) {
      event.context.registerDamage({
        target: event.defender,
        amount: 0,
        sourceId: event.attacker?.id,
        element: event.element,
        contact: event.contact,
        hitVfx: event.hitVfx,
        hitVfxPalette: event.hitVfxPalette,
        skillKey: event.skill?.key ?? null,
        flags: { evaded: true },
      });

      event.context.registerHookLogs(
        emitCombatEvent(
          "onEvade",
          {
            attacker: event.attacker,
            defender: event.defender,
            damage: event.damage,
            context: event.context,
          },
          event.allChampions,
        ),
      );

      return _buildEvadeResult(event);
    }
  }

  // 3️⃣ SHIELD BLOCK
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.skill?.cannotBeBlocked
  ) {
    const blockedBy = event.defender._checkAndConsumeShieldBlock?.(
      event.context,
      event.type,
    );
    if (blockedBy) {
      event.context.registerDamage({
        target: event.defender,
        amount: 0,
        sourceId: event.attacker?.id,
        element: event.element,
        contact: event.contact,
        hitVfx: event.hitVfx,
        hitVfxPalette: event.hitVfxPalette,
        skillKey: event.skill?.key ?? null,
        flags: { shieldBlocked: true },
      });

      return _buildShieldBlockResult(event, blockedBy);
    }
  }
  return null;
}

function _rollEvasion({ defender, context, debugMode }) {
  const editMode = context?.editMode ?? {};
  const chance = Number(defender.Evasion) || 0;

  // Debug override: always evade.
  if (editMode.alwaysEvade) return { attempted: true, evaded: true };

  // No Evasion means no attempt at all.
  if (chance <= 0) return null;

  const roll = Math.random() * 100;
  const evaded = roll < chance;

  if (debugMode) {
    console.log(`🎯 Evasion roll: ${roll.toFixed(2)}`);
    console.log(`🎲 Evasion chance: ${chance}%`);
    console.log(evaded ? "✅ Attack EVADED!" : "❌ Attack HIT");
  }

  return { evaded, attempted: true };
}

// The skill's name for player text, with a per-locale fallback.
function _skillName(event) {
  const name = event.skill?.name;
  return name ? { en: name, pt: name } : { en: "a skill", pt: "uma habilidade" };
}

function _buildEvadeResult(event) {
  const targetName = formatChampionName(event.defender);
  const username = formatChampionName(event.attacker);
  const skillName = _skillName(event);

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker.id,
    hitId: event.hitId,
    shieldBlocked: false,
    evaded: true,
    type: event.type,
    log: {
      en: `${targetName} evaded ${username}'s ${skillName.en}!`,
      pt: `${targetName} esquivou de ${skillName.pt} de ${username}!`,
    },
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

function _buildImmuneResult(event, customMessage = null, opts = {}) {
  return _buildBlockedResult(event, customMessage, { ...opts, kind: "immune" });
}

function _buildUnreachableResult(event, customMessage = null, opts = {}) {
  return _buildBlockedResult(event, customMessage, {
    ...opts,
    kind: "unreachable",
  });
}

// Damage stopped before it could apply. `kind` is "immune" (a ward nullified it)
// or "unreachable" (the hit never landed — stealth, spawn protection).
function _buildBlockedResult(
  event,
  customMessage = null,
  { quiet = false, kind = "immune", silent = false } = {},
) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = _skillName(event);

  // A silent block leaves no visual and no log: the target is simply not there.
  if (!silent) {
    event.context.registerDamage({
      target: event.defender,
      amount: 0,
      sourceId: event.attacker?.id ?? null,
      element: event.element,
      contact: event.contact,
      hitVfx: event.hitVfx,
      hitVfxPalette: event.hitVfxPalette,
      skillKey: event.skill?.key ?? null,
      flags: { [kind]: true, immuneMessage: customMessage, immuneQuiet: quiet },
    });
  }

  const log = silent
    ? undefined
    : customMessage
      ? customMessage
      : username
        ? {
            en: `${username} tried to use ${skillName.en} on ${targetName}, but the target is immune!`,
            pt: `${username} tentou usar ${skillName.pt} em ${targetName}, mas o alvo está imune!`,
          }
        : {
            en: `${targetName} is immune to the damage!`,
            pt: `${targetName} está imune ao dano!`,
          };

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    hitId: event.hitId,
    evaded: false,
    [kind]: true,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

function _inactiveDialogKey(defenderId) {
  return `inactive-target:${defenderId}`;
}

function _buildInactiveTargetResult(event) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = _skillName(event);

  const alreadyExplained = event.context.dialogDedupeKeys.has(
    _inactiveDialogKey(event.defender?.id ?? targetName),
  );

  if (!alreadyExplained) {
    event.context.registerDialog({
      message: {
        en: `${targetName} is not active in combat and could not be hit.`,
        pt: `${targetName} não está ativo em combate e não pôde ser atingido.`,
      },
      dedupeKey: _inactiveDialogKey(event.defender?.id ?? targetName),
      sourceId: event.attacker?.id ?? null,
      targetId: event.defender?.id ?? null,
      damageDepth: event.damageDepth ?? 0,
    });
  }

  const log = alreadyExplained
    ? undefined
    : username
      ? {
          en: `${username} tried to use ${skillName.en} on ${targetName}, but the target is not active in combat.`,
          pt: `${username} tentou usar ${skillName.pt} em ${targetName}, mas o alvo não está ativo em combate.`,
        }
      : {
          en: `${targetName} is not active in combat.`,
          pt: `${targetName} não está ativo em combate.`,
        };

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    hitId: event.hitId,
    evaded: false,
    inactiveTarget: true,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

// What each blocking shield is called, and what it stopped.
const BLOCKING_SHIELD_TEXT = {
  supreme: {
    en: { name: "Supreme Shield", blocked: "the hit" },
    pt: { name: "Escudo Supremo", blocked: "o golpe" },
  },
  spell: {
    en: { name: "Spell Shield", blocked: "the magical damage" },
    pt: { name: "Escudo Mágico", blocked: "o dano mágico" },
  },
};

function _buildShieldBlockResult(event, blockedBy) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = _skillName(event);
  const { en, pt } = BLOCKING_SHIELD_TEXT[blockedBy];

  const log = username
    ? {
        en: `${username} used ${skillName.en} on ${targetName}, but ${targetName}'s ${en.name} blocked ${en.blocked} and faded away!`,
        pt: `${username} usou ${skillName.pt} em ${targetName}, mas o ${pt.name} de ${targetName} bloqueou ${pt.blocked} e se dissipou!`,
      }
    : {
        en: `${targetName}'s ${en.name} blocked ${en.blocked} and faded away!`,
        pt: `O ${pt.name} de ${targetName} bloqueou ${pt.blocked} e se dissipou!`,
      };

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    hitId: event.hitId,
    shieldBlocked: true,
    evaded: false,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}
