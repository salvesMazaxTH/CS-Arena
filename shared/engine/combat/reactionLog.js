import { formatChampionName } from "../../ui/formatters.js";

/** Builds a `hitLog` for a hit nobody chose to throw (thorns, reflections,
 *  recoil, passive answers), replacing the generic "X used Skill" line.
 *  `buildLine({ source, target, dmg })` returns the { en, pt } sentence; the
 *  final HP line is appended here. */
export function reactionLog(buildLine) {
  return (hit) => {
    const source = formatChampionName(hit.attacker);
    const target = formatChampionName(hit.defender);
    const dmg = Math.floor(hit.damage);
    const crit = hit.crit?.didCrit;
    const hp = `${hit.hpAfter}/${hit.defender.maxHP}`;
    const line = buildLine({ source, target, dmg });

    return {
      en: `${line.en}${crit ? " (CRITICAL)" : ""}\nfinal HP of ${target}: ${hp}`,
      pt: `${line.pt}${crit ? " (CRÍTICO)" : ""}\nHP final de ${target}: ${hp}`,
    };
  };
}

/** Self-inflicted recoil of a skill, e.g. "[Recoil — Skill] X takes N damage". */
export function recoilLog(skill) {
  return reactionLog(({ target, dmg }) => ({
    en: `<b>[Recoil — ${skill.name}]</b> ${target} takes ${dmg} damage`,
    pt: `<b>[Recuo — ${skill.name}]</b> ${target} sofre ${dmg} de dano`,
  }));
}
