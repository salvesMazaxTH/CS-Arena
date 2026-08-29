import { formatChampionName } from "../../../ui/formatters.js";
import { emitCombatEvent } from "../combatEvents.js";
import { SpawnProtection } from "../spawnProtection.js";

export function preChecks(event) {
  /*     console.log("DEBUG ATTACKER:", event.attacker);
  console.log("DEBUG DEFENDER:", event.defender); */
  const activeChampions =
    event?.context?.activeChampions ?? event?.context?.allChampions;

  if (
    !event?.defender?.id ||
    !event.defender.alive ||
    (activeChampions instanceof Map && !activeChampions.has(event.defender.id))
  ) {
    return _buildInactiveTargetResult(event);
  }

  if (SpawnProtection.isActive(event.defender)) {
    return _buildImmuneResult(
      event,
      SpawnProtection.unreachableMessage(event.defender),
      { quiet: true },
    );
  }

  // 1️⃣ IMUNIDADE
  const results = emitCombatEvent(
    "onDamageIncoming",
    {
      attacker: event.attacker,
      defender: event.defender,
      damage: event.damage,
      skill: event.skill,
      element: event.element,
      type: event.type,
      context: event.context,
    },
    event.allChampions,
  );

  for (const r of results) {
    if (r?.message) {
      event.context?.logs?.push?.(r.message);
    }

    if (r?.cancel) {
      console.log(
        `[DAMAGE CANCEL] ${event.defender.name} teve o dano cancelado por status-effect`,
      );
      return r.unreachable
        ? _buildUnreachableResult(event, r.message ?? null)
        : _buildImmuneResult(event, r.message ?? null);
    }

    if (r?.modifiedDamage !== undefined) {
      console.log(
        `[DAMAGE MODIFIED] ${event.defender.name} teve o dano modificado de ${event.damage} para ${r.modifiedDamage} por status-effect/hook externo. Detalhes:`,
        r,
      );
      event.damage = r.modifiedDamage;
    }
  }

  // 2️⃣ ESQUIVA
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.skill?.cannotBeEvaded
  ) {
    const evasion = _rollEvasion({
      attacker: event.attacker,
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

      return {
        totalDamage: 0,
        evaded: true,
        targetId: event.defender.id,
        userId: event.attacker.id,
        type: event.type,
      };
    }
  }

  // 3️⃣ SHIELD BLOCK
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.skill?.cannotBeBlocked
  ) {
    if (
      event.defender._checkAndConsumeShieldBlock?.(event.context, event.type)
    ) {
      event.context.registerDamage({
        target: event.defender,
        amount: 0,
        sourceId: event.attacker?.id,
        flags: { shieldBlocked: true },
      });

      return _buildShieldBlockResult(event);
    }
  }
  return null;
}

function _rollEvasion({ attacker, defender, context, debugMode }) {
  const editMode = context?.editMode ?? {};
  const chance = Number(defender.Evasion) || 0;

  if (debugMode) {
    console.log("🔥 _rollEvasion chamado:", {
      attacker: attacker.name,
      defender: defender.name,
      evasion: chance,
      editMode,
    });
  }

  // 1️⃣ Override absoluto (debug)
  if (editMode.alwaysEvade) {
    return {
      attempted: true,
      evaded: true,
      log: `\n${formatChampionName(defender)} evadiu automaticamente.`,
    };
  }

  // 2️⃣ Sem chance real
  if (chance <= 0 && !editMode.alwaysEvade) {
    return null; // NÃO houve tentativa
  }

  // 3️⃣ Roll
  const roll = Math.random() * 100;
  const evaded = roll < chance;

  if (debugMode) {
    console.log(`🎯 Roll de Esquiva: ${roll.toFixed(2)}`);
    console.log(`🎲 Chance de Esquiva: ${chance}%`);
    console.log(evaded ? "✅ Ataque EVADIDO!" : "❌ Ataque ACERTADO");
  }

  // 4️⃣ Resultado padronizado
  return {
    evaded,
    attempted: true,
    log: `\n${formatChampionName(defender)} tentou esquivar o ataque... !`,
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
  { quiet = false, kind = "immune" } = {},
) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = event.skill?.name || "habilidade";

  event.context.registerDamage({
    target: event.defender,
    amount: 0,
    sourceId: event.attacker?.id ?? null,
    flags: { [kind]: true, immuneMessage: customMessage, immuneQuiet: quiet },
  });

  const log = customMessage
    ? customMessage
    : username
      ? `${username} tentou usar ${skillName} em ${targetName}, mas o alvo possui Imunidade Absoluta!`
      : `${targetName} é imune ao dano!`;

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    evaded: false,
    [kind]: true,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

function _buildInactiveTargetResult(event) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = event.skill?.name || "habilidade";
  const message = `${targetName} não está ativo em combate e não pôde ser atingido.`;

  event.context.registerDialog({
    message,

    sourceId: event.attacker?.id ?? null,
    targetId: event.defender?.id ?? null,
    damageDepth: event.damageDepth ?? 0,
  });

  const log = username
    ? `${username} tentou usar ${skillName} em ${targetName}, mas o alvo não está ativo em combate.`
    : `${targetName} não está ativo em combate.`;

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    evaded: false,
    inactiveTarget: true,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

function _buildShieldBlockResult(event) {
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = event.skill?.name || "habilidade";

  const log = username
    ? `${username} usou ${skillName} em ${targetName}, mas o Escudo de Feitiço de ${targetName} bloqueou o dano mágico e se dissipou!`
    : `${targetName} bloqueou um dano mágico com Escudo de Feitiço e ele se dissipou!`;

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    shieldBlocked: true,
    evaded: false,
    type: event.type,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}
