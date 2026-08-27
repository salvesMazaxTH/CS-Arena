import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import { isFeiticeiro } from "./feiticeiro.js";

const MAX_GRUDGE = 5;
const GRUDGE_PER_POINT = 2;

export default {
  key: "ledger_of_old_wounds",
  name: "Ledger of Old Wounds",

  maxGrudge: MAX_GRUDGE,
  grudgePerPoint: GRUDGE_PER_POINT,

  description(champion) {
    const grudge = champion?.runtime?.dorianGrudge || 0;

    return `Every feiticeiro Dorian has bled is a mark under his skin, sealed in the vials he carved into himself, and the account never closes on its own. Each turn he wounds an enemy feiticeiro he keeps one Grudge (max ${this.maxGrudge}); his next Claim cashes the whole ledger for 1 extra point per ${this.grudgePerPoint} Grudge spent, while a lone Grudge — or a wound torn from anyone who is not a feiticeiro — pays nothing.

    Grudge: <b>${grudge}/${this.maxGrudge}</b>`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onActionResolved: "actionSource",
  },

  onAfterDmgDealing({ owner, defender, damage, context }) {
    if (!(damage > 0) || !defender || defender.team === owner.team) return;
    if (!isFeiticeiro(defender)) return;
    if (context.currentTurn === owner.runtime.dorianGrudgeTurn) return;

    const before = owner.runtime.dorianGrudge ?? 0;
    if (before >= MAX_GRUDGE) return;

    owner.runtime.dorianGrudge = before + 1;
    owner.runtime.dorianGrudgeTurn = context.currentTurn;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} marks ${formatChampionName(defender)} in the ledger — Grudge ${owner.runtime.dorianGrudge}/${MAX_GRUDGE}.`,
    };
  },

  onActionResolved({ owner, skill }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const grudge = owner.runtime.dorianGrudge ?? 0;
    const points = Math.floor(grudge / GRUDGE_PER_POINT);
    if (points <= 0) return;

    owner.runtime.dorianGrudge = grudge % GRUDGE_PER_POINT;

    return {
      type: "score",
      amount: points,
      scoringSlot: owner.team - 1,
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} cashes the ledger on his Claim — ${points} extra point(s), ${owner.runtime.dorianGrudge} Grudge left over.`,
    };
  },
};
