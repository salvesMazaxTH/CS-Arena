import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export const KEPT_RUNTIME_FLAG = "ysvaneKeptUntilTurn";
export const KEPT_DURATION = 2;

export default {
  key: "what_the_keep_holds",
  name: "What the Keep Holds",

  claimBonusPoints: 2,
  lootTax: 2,
  lootMinimum: 1,

  description() {
    return {
      en: `Ysvane is old enough to be the vault rather than its warden, and what she wards is not allowed to slip. An ally she lays her <b>Affliction Ward</b> over is <b>Kept</b> for <b>${KEPT_DURATION}</b> turn(s); when a <b>Kept</b> ally uses CLAIM the grab holds fast in the cold, and their team banks <b>${this.claimBonusPoints}</b> extra point(s) from it.

      The Keep is not looted for free either: when a <b>Kept</b> ally falls, Ysvane's team banks whatever that kill just paid the enemy, minus <b>${this.lootTax}</b> (at least <b>${this.lootMinimum}</b> point).`,
      pt: `Ysvane é velha o bastante para ser o cofre em vez de sua guardiã, e o que ela resguarda não tem permissão de escapar. Uma aliada sobre quem ela lança sua <b>Proteção contra Aflição</b> fica <b>Resguardada</b> por <b>${KEPT_DURATION}</b> turno(s); quando uma aliada <b>Resguardada</b> usa CLAIM, a captura se firma no frio, e o time dela ganha <b>${this.claimBonusPoints}</b> ponto(s) extra por isso.

      O Cofre também não é saqueado de graça: quando uma aliada <b>Resguardada</b> cai, o time de Ysvane ganha o que aquela morte acabou de pagar ao inimigo, menos <b>${this.lootTax}</b> (no mínimo <b>${this.lootMinimum}</b> ponto).`,
    };
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team !== owner.team) return;

    const keptUntil = Number(actionSource.runtime?.[KEPT_RUNTIME_FLAG] ?? 0);
    if (keptUntil <= context.currentTurn) return;

    context.registerScore({
      amount: this.claimBonusPoints,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)}'s CLAIM holds fast in the cold — ${this.claimBonusPoints} extra point(s).`,
    };
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion.team !== owner.team) return;

    const keptUntil = Number(deadChampion.runtime?.[KEPT_RUNTIME_FLAG] ?? 0);
    if (keptUntil <= context.currentTurn) return;

    const conceded = Number(deadChampion.runtime?.deathConcededPoints ?? 0);
    if (conceded <= 0) return;
    const reclaimed = Math.max(this.lootMinimum, conceded - this.lootTax);

    context.registerScore({
      amount: reclaimed,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(deadChampion)} was under the Keep — ${reclaimed} point(s) come back out of it.`,
    };
  },
};
