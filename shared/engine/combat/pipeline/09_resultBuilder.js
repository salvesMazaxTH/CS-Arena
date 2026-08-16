// step9 - resultBuilder.js - Consolidates the final result of the attack, including logs, total damage, final HP, etc. Can be an object or an array (in case of counter-attacks/reflects).
import { formatChampionName } from "../../../ui/formatters.js";

export function buildFinalResult(event) {
  // Consolidates all logs (those from the pipeline + any that hooks may have added to the context)
  const allLogs = [
    ...event.beforeLogs,
    ...event.afterLogs,
    // ...(event.context.extraLogs || []),
  ];

  let finalLog;
  if (event.context?.isDot) {
    const targetName = formatChampionName(event.defender);
    const effectName =
      event.skill && typeof event.skill === "object"
        ? event.skill.name
        : event.skill;
    const dmg = Math.floor(event.damage);
    finalLog = `${targetName} took ${dmg} damage${
      effectName ? ` from <b>${effectName}</b>` : ""
    }`;
    finalLog += `\nfinal HP of ${targetName}: ${event.hpAfter}/${event.defender.maxHP}`;
  } else {
    finalLog = _buildLog(
      event.attacker,
      event.defender,
      event.skill,
      event.damage,
      event.crit,
      event.hpAfter,
    );
  }

  if (allLogs.length) {
    finalLog += "\n" + allLogs.join("\n");
  }

  if (event.constructor.debugMode) console.groupEnd(); // Close the debug group if it was opened

  const mainResult = {
    totalDamage: event.actualDmg,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    killed: event.defender.alive === false,
    type: event.type,
    log: finalLog,
    crit: event.crit,
    damageDepth: event.context.damageDepth,
    skill: event.skill,
    // We include the damage journey for debugging/panels if needed
    journey: {
      base: event.baseDamage,
      mitigated: event.damage,
      actual: event.actualDmg,
    },
  };

  // If there are counter-attacks/reflects, return an array, otherwise the single object
  return event.extraResults.length > 0
    ? [mainResult, ...event.extraResults]
    : mainResult;
}

function _buildLog(user, target, skill, dmg, crit, hpAfter) {
  const userName = user ? formatChampionName(user) : "Effect";
  const targetName = formatChampionName(target);

  // skill can be a string (skill name) or an object (skill instance)
  const skillName = skill && typeof skill === "object" ? skill.name : skill;
  dmg = Math.floor(dmg);
  let log = `${userName} used <b>${skillName}</b> and dealt ${dmg} damage to ${targetName}`;

  if (crit.didCrit) log += ` (CRITICAL)`;

  log += `\nfinal HP of ${targetName}: ${hpAfter}/${target.maxHP}`;

  return log;
}
