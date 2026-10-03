// step9 - resultBuilder.js - Consolidates the final result of the attack, including logs, total damage, final HP, etc. Can be an object or an array (in case of counter-attacks/reflects).
import { formatChampionName } from "../../../ui/formatters.js";
import { resolveText } from "../../../i18n/locale.js";

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
    const hpLine = `${event.hpAfter}/${event.defender.maxHP}`;
    const effect = effectName ? ` <b>${effectName}</b>` : "";
    finalLog = {
      en: `${targetName} took ${dmg} damage${effect && ` from${effect}`}\nfinal HP of ${targetName}: ${hpLine}`,
      pt: `${targetName} sofreu ${dmg} de dano${effect && ` de${effect}`}\nHP final de ${targetName}: ${hpLine}`,
    };
  } else if (typeof event.hitLog === "function") {
    // A reaction hit can word its own line (e.g. Thorns returning damage).
    finalLog = event.hitLog(event);
  } else {
    finalLog = _buildLog(
      event.attacker,
      event.defender,
      event.hitLabel ?? event.skill,
      event.damage,
      event.crit,
      event.hpAfter,
    );
  }

  const mainResult = {
    totalDamage: event.actualDmg,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    killed: event.defender.alive === false,
    type: event.type,
    element: event.element,
    contact: event.contact,
    hitVfx: event.hitVfx,
    hitVfxPalette: event.hitVfxPalette,
    hitId: event.hitId,
    shieldBroken: event.shieldBroken,
    // Entries stay unjoined so bilingual { en, pt } logs survive to the client.
    log: [finalLog, ...allLogs].flat(Infinity).filter(Boolean),
    crit: event.crit,
    damageDepth: event.context.damageDepth,
    skill: event.skill,
    // Damage breakdown, read by scripts/damageEventLab.js.
    journey: {
      base: event.baseDamage,
      bonus: event.bonusDamage,
      mitigated: event.mitigatedDamage,
      final: event.damage,
      actual: event.actualDmg,
    },
  };

  // If there are counter-attacks/reflects, return an array, otherwise the single object
  return event.extraResults.length > 0
    ? [mainResult, ...event.extraResults]
    : mainResult;
}

function _buildLog(user, target, skill, dmg, crit, hpAfter) {
  const targetName = formatChampionName(target);
  // skill is a skill instance or a hit label; a label may be { en, pt }
  const label = skill?.name ?? skill;
  dmg = Math.floor(dmg);
  const hpLine = `${hpAfter}/${target.maxHP}`;

  return {
    en: `${user ? formatChampionName(user) : "Effect"} used <b>${resolveText(label, "en")}</b> and dealt ${dmg} damage to ${targetName}${crit.didCrit ? " (CRITICAL)" : ""}\nfinal HP of ${targetName}: ${hpLine}`,
    pt: `${user ? formatChampionName(user) : "Efeito"} usou <b>${resolveText(label, "pt")}</b> e causou ${dmg} de dano a ${targetName}${crit.didCrit ? " (CRÍTICO)" : ""}\nHP final de ${targetName}: ${hpLine}`,
  };
}
