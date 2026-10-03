import { emitCombatEvent, collectHookLogs } from "../combatEvents.js";
import { HealEvent } from "../HealEvent.js";

export function runAfterHooks(event) {
  // Defender reacts before the attacker reaps: mirror of the before phase.
  const afterTake = _applyAfterTakingPassive(event);
  const afterDeal = _applyAfterDealingPassive(event);

  // 2. Sync passive logs and effects
  if (afterTake.logs.length) event.afterLogs.push(...afterTake.logs);
  if (afterDeal.logs.length) event.afterLogs.push(...afterDeal.logs);

  // 3. Lifesteal
  const lsResult = _applyLifeSteal(event);

  if (lsResult) {
    // Stored on the event for the result builder
    event.lifesteal = lsResult;

    // Lifesteal log, plus any passives it triggered
    event.afterLogs.push(lsResult.log);
    if (lsResult.passiveLogs?.length) {
      event.afterLogs.push(...lsResult.passiveLogs);
    }
  }
}

function _applyLifeSteal(event) {
  if (event.constructor.debugMode) console.group(`💉 [LIFESTEAL]`);

  // 1. Gate
  const lsRate = event.attacker?.LifeSteal || 0;
  if (lsRate <= 0 || event.actualDmg <= 0 || !event.allowsLifeSteal) {
    if (event.constructor.debugMode) {
      console.log(
        `⚠️ Skipping lifesteal: LS=${lsRate}%, DMG=${event.actualDmg}`,
      );
      console.groupEnd();
    }
    return null;
  }

  // 2. Heal amount
  const rawHeal = (event.actualDmg * lsRate) / 100;

  // 3. Apply it (heal() floors it with a minimum of 1)
  const effectiveHeal = new HealEvent({
    target: event.attacker,
    amount: rawHeal,
    context: event.context,
    source: event.attacker,
    type: "lifesteal",
    fromTargetId: event.defender?.id ?? null,
  }).execute();

  if (effectiveHeal <= 0) {
    if (event.constructor.debugMode) console.groupEnd();
    return null;
  }

  if (event.constructor.debugMode) {
    console.log(
      `📊 Effective: ${effectiveHeal} (HP: ${event.attacker.HP}/${event.attacker.maxHP})`,
    );
    console.groupEnd();
  }

  return {
    amount: effectiveHeal,
    log: {
      en: `Lifesteal: ${effectiveHeal} | HP: ${event.attacker.HP}/${event.attacker.maxHP}`,
      pt: `Roubo de vida: ${effectiveHeal} | HP: ${event.attacker.HP}/${event.attacker.maxHP}`,
    },
  };
}

function _applyAfterTakingPassive(event) {
  return _processHook(event, "onAfterDmgTaking", {
    attacker: event.attacker,
    defender: event.defender,
    skill: event.skill,
    hitId: event.hitId,
    element: event.element,
    contact: event.contact,
    damage: event.damage,
    bonusDamage: event.bonusDamage,
    actualDmg: event.actualDmg,
    mode: event.mode,
    crit: event.crit,
    context: event.context,
    type: event.type,
  });
}

function _applyAfterDealingPassive(event) {
  if (event.context?.isDot) return { logs: [] };
  return _processHook(event, "onAfterDmgDealing", {
    attacker: event.attacker,
    defender: event.defender,
    damage: event.damage,
    bonusDamage: event.bonusDamage,
    actualDmg: event.actualDmg,
    mode: event.mode,
    crit: event.crit,
    skill: event.skill,
    hitId: event.hitId,
    element: event.element,
    contact: event.contact,
    context: event.context,
  });
}

function _processHook(event, eventName, payload) {
  const results =
    emitCombatEvent(eventName, payload, event.allChampions, {
      players: event.players,
      canRun: (name, champ, source) => event.canRunHook(name, champ, source),
    }) || [];
  const summary = { logs: [] };

  for (const r of results) {
    if (!r) continue;

    collectHookLogs(r, summary.logs);
  }
  return summary;
}
