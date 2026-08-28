import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import { isSorcerer } from "./sorcerer.js";

export default {
  key: "ledger_of_old_wounds",
  name: "Ledger of Old Wounds",

  maxGrudge: 5,
  grudgePerPoint: 2,

  description(champion) {
    const grudge = champion?.runtime?.dorianGrudge || 0;

    return `Every sorcerer Dorian has bled is a mark under his skin, sealed in the vials he carved into himself, and the account never closes on its own. Each turn he wounds an enemy sorcerer he keeps one Grudge (max ${this.maxGrudge}); his next Claim cashes the whole ledger for 1 extra point per ${this.grudgePerPoint} Grudge spent, while a lone Grudge — or a wound torn from anyone who is not a sorcerer — pays nothing.

    Grudge: <b>${grudge}/${this.maxGrudge}</b>`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onActionResolved: "actionSource",
  },

  onAfterDmgDealing({ owner, defender, damage, context }) {
    if (!(damage > 0) || !defender || defender.team === owner.team) return;
    if (!isSorcerer(defender)) return;
    if (context.currentTurn === owner.runtime.dorianGrudgeTurn) return;

    const before = owner.runtime.dorianGrudge ?? 0;
    if (before >= this.maxGrudge) return;

    owner.runtime.dorianGrudge = before + 1;
    owner.runtime.dorianGrudgeTurn = context.currentTurn;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} marks ${formatChampionName(defender)} in the ledger — Grudge ${owner.runtime.dorianGrudge}/${this.maxGrudge}.`,
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
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} cashes the ledger on his Claim — ${points} extra point(s), ${owner.runtime.dorianGrudge} Grudge left over.`,
    };
  },
};
