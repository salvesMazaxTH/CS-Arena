import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { getDuoForCore } from "../../duos.js";

export const TWIN_BOND_TEXT = {
  en: `Laisaelis and Laiserisa are two halves of one existence, and neither half can stand alone: the moment one sister truly dies, the other ceases with her.`,
  pt: `Laisaelis e Laiserisa são duas metades de uma única existência, e nenhuma das metades consegue se manter sozinha: no instante em que uma irmã morre de verdade, a outra cessa com ela.`,
};

function twinKeyOf(champion) {
  return getDuoForCore(champion.championKey)?.cores.find(
    (coreKey) => coreKey !== champion.championKey,
  );
}

/** The other half standing on the same team; an enemy sister is never a match. */
export function findTwin(champion, context) {
  const twinKey = twinKeyOf(champion);

  return context.aliveChampions.find(
    (other) =>
      other.team === champion.team && other.championKey === twinKey,
  );
}

/**
 * Damage a cheat-death hook should return so the champion lands at exactly
 * `survivalHP`: regular shields drain first, as they would against the real blow.
 */
export function survivalDamage(champion, survivalHP) {
  return Math.max(champion.HP + regularShieldTotal(champion) - survivalHP, 0);
}

/** The innate half both sisters share; returns whether the owner was taken along. */
export function dieWithTwin({ owner, deadChampion, context }, passiveName) {
  if (!owner.alive || owner === deadChampion) return false;
  if (deadChampion.team !== owner.team) return false;

  if (deadChampion.championKey !== twinKeyOf(owner)) return false;

  owner.HP = 0;
  owner.alive = false;

  context.registerDialog({
    message: {
      en: `[Passive - <b>${passiveName}</b>] With ${formatChampionName(deadChampion)} gone, ${formatChampionName(owner)} has nothing left to remain for.`,
      pt: `[Passiva - <b>${passiveName}</b>] Com ${formatChampionName(deadChampion)} ausente, ${formatChampionName(owner)} não tem mais motivo para permanecer.`,
    },
    sourceId: deadChampion.id,
    targetId: owner.id,
  });

  return true;
}
