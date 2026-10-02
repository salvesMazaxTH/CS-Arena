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

/**
 * An ultimate's `maxTriggers` counts the saves it actually delivered, kept on
 * the caster; merely casting it, or leaving its aura to lapse, spends nothing.
 */
export function ultimateSavesLeft(caster, skill) {
  return skill.maxTriggers - (caster.runtime?.ultimateSaves?.[skill.key] ?? 0);
}

export function spendUltimateSave(caster, skill) {
  caster.runtime.ultimateSaves ??= {};
  caster.runtime.ultimateSaves[skill.key] =
    (caster.runtime.ultimateSaves[skill.key] ?? 0) + 1;
}

/** The live "saves left" line closing an ultimate's description, scoped to this match. */
export function ultimateSavesLine(caster, skill) {
  const left = caster ? ultimateSavesLeft(caster, skill) : skill.maxTriggers;
  const count = `<b>${left}/${skill.maxTriggers}</b>`;

  return {
    en: `<b>Saves left this match:</b> ${count}`,
    pt: `<b>Salvações restantes nesta partida:</b> ${count}`,
  };
}

export const ULTIMATE_SPENT_TEXT = {
  en: (name) => `<b>${name}</b> has already delivered all of its saves this match.`,
  pt: (name) => `<b>${name}</b> já entregou todas as suas salvações nesta partida.`,
};

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
