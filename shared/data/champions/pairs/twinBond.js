import { formatChampionName } from "../../../ui/formatters.js";
import { getDuoForCore } from "../../duos.js";

export const TWIN_BOND_TEXT = `Laisaelis and Laiserisa are two halves of one existence, and neither half can stand alone: the moment one sister truly dies, the other ceases with her.`;

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

/** The innate half both sisters share; returns whether the owner was taken along. */
export function dieWithTwin({ owner, deadChampion, context }, passiveName) {
  if (!owner.alive || owner === deadChampion) return false;
  if (deadChampion.team !== owner.team) return false;

  if (deadChampion.championKey !== twinKeyOf(owner)) return false;

  owner.HP = 0;
  owner.alive = false;

  context.registerDialog({
    message: `[Passive - <b>${passiveName}</b>] With ${formatChampionName(
      deadChampion,
    )} gone, ${formatChampionName(owner)} has nothing left to remain for.`,
    sourceId: deadChampion.id,
    targetId: owner.id,
  });

  return true;
}
