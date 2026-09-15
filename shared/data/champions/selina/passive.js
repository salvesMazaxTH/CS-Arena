import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export const SELINA_WARD = "selina_ward";

const riposteSkill = {
  key: "mercys_reach_riposte",
  name: "Mercy's Reach",
  contact: true,
  hitVfx: "slash",
};

export default {
  key: "mercys_reach",
  name: "Mercy's Reach",

  claimShieldAmount: 35,
  claimShieldDecay: 12,
  riposteDamage: 30,

  description() {
    return `Selina was raised in gilded halls, but her light bends first toward whoever is closest to breaking. Whenever an ally uses CLAIM, herself included, her light answers on its own — granting ${this.claimShieldAmount} Shield that decays by ${this.claimShieldDecay} per turn. Whenever an ally still carrying one of her Shields is struck, Selina answers the attacker with ${this.riposteDamage} <b>Absolute Damage</b>, once per turn.`;
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team !== owner.team) return;

    actionSource.addShield(
      this.claimShieldAmount,
      this.claimShieldDecay,
      context,
      "regular",
      { source: SELINA_WARD },
    );

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)}'s CLAIM draws Selina's light — ${this.claimShieldAmount} Shield granted.`,
    };
  },

  onAfterDmgTaking({ owner, defender, attacker, damage, context }) {
    if (!owner.alive || !(damage > 0)) return;
    if (!defender || defender.team !== owner.team) return;
    if (!attacker || !attacker.alive || attacker.team === owner.team) return;
    if (owner.runtime.selinaRiposteTurn === context.currentTurn) return;

    const warded = defender.runtime.shields?.some(
      (shield) => shield.source === SELINA_WARD,
    );
    if (!warded) return;

    owner.runtime.selinaRiposteTurn = context.currentTurn;

    context.extraDamageQueue ??= [];
    context.extraDamageQueue.push({
      baseDamage: this.riposteDamage,
      attacker: owner,
      defender: attacker,
      skill: riposteSkill,
      type: "physical",
      contact: true,
      mode: "absolute",
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} answers for ${formatChampionName(defender)} — her blade opens ${formatChampionName(attacker)} for ${this.riposteDamage}.`,
    };
  },
};
