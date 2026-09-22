import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "ledger_of_old_wounds",
  name: "Ledger of Old Wounds",

  maxGrudge: 5,
  grudgePerPoint: 2,

  description(champion) {
    const grudge = champion?.runtime?.dorianGrudge || 0;

    return {
      en: `Every enchanter Dorian has bled is a mark under his skin, sealed in the vials he carved into himself, and the account never closes on its own. Each turn he wounds an enemy <b>enchanter</b> he keeps one <b>Grudge</b> (max <b>${this.maxGrudge}</b>); his next <b>CLAIM</b> cashes the whole ledger for <b>1</b> extra point per <b>${this.grudgePerPoint}</b> Grudge spent, while a lone Grudge — or a wound torn from anyone who is not an enchanter — pays nothing.

      Grudge: <b>${grudge}/${this.maxGrudge}</b>`,
      pt: `Cada encantador que Dorian já feriu é uma marca sob sua pele, selada nos frascos que ele cravou no próprio corpo, e a conta nunca se fecha sozinha. A cada turno em que fere um <b>encantador</b> inimigo ele guarda uma <b>Mágoa</b> (máx. <b>${this.maxGrudge}</b>); seu próximo <b>CLAIM</b> resgata o livro inteiro por <b>1</b> ponto extra a cada <b>${this.grudgePerPoint}</b> Mágoas gastas, enquanto uma Mágoa isolada — ou um ferimento tirado de alguém que não seja encantador — não paga nada.

      Mágoa: <b>${grudge}/${this.maxGrudge}</b>`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onActionResolved: "actionSource",
  },

  onAfterDmgDealing({ owner, defender, actualDmg, context }) {
    if (!(actualDmg > 0) || !defender || defender.team === owner.team) return;
    if (defender.classKey !== "enchanter") return;
    if (context.currentTurn === owner.runtime.dorianGrudgeTurn) return;

    const before = owner.runtime.dorianGrudge ?? 0;
    if (before >= this.maxGrudge) return;

    owner.runtime.dorianGrudge = before + 1;
    owner.runtime.dorianGrudgeTurn = context.currentTurn;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} marks ${formatChampionName(defender)} in the ledger — Grudge ${owner.runtime.dorianGrudge}/${this.maxGrudge}.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} marca ${formatChampionName(defender)} no livro — Mágoa ${owner.runtime.dorianGrudge}/${this.maxGrudge}.`,
      },
    };
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const grudge = owner.runtime.dorianGrudge ?? 0;
    const points = Math.floor(grudge / this.grudgePerPoint);
    if (points <= 0) return;

    owner.runtime.dorianGrudge = grudge % this.grudgePerPoint;

    context.registerScore({
      amount: points,
      scoringSlot: owner.team - 1,
      reason: this.key,
      sourceId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} cashes the ledger on his CLAIM — ${points} extra point(s), ${owner.runtime.dorianGrudge} Grudge left over.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} resgata o livro no seu CLAIM — ${points} ponto(s) extra, ${owner.runtime.dorianGrudge} Mágoa(s) restante(s).`,
      },
    };
  },
};
