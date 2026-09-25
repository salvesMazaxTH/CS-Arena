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
    return {
      en: `Selina was raised in gilded halls, but her light bends first toward whoever is closest to breaking. Whenever an ally uses <b>CLAIM</b>, herself included, her light answers on its own — granting <b>${this.claimShieldAmount}</b> Shield that decays by <b>${this.claimShieldDecay}</b> per turn. Whenever an ally still carrying one of her Shields is struck, Selina answers the attacker with <b>${this.riposteDamage}</b> <b>Absolute Damage</b>, once per turn.`,
      pt: `Selina cresceu em salões dourados, mas sua luz se volta primeiro a quem está mais perto de quebrar. Sempre que um aliado usa <b>CLAIM</b>, ela incluída, sua luz responde sozinha — concedendo <b>${this.claimShieldAmount}</b> de Escudo que decai <b>${this.claimShieldDecay}</b> por turno. Sempre que um aliado ainda carregando um de seus Escudos é atingido, Selina responde ao atacante com <b>${this.riposteDamage}</b> de <b>Dano Absoluto</b>, uma vez por turno.`,
    };
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
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)}'s <b>CLAIM</b> draws Selina's light — <b>${this.claimShieldAmount}</b> Shield granted.`,
        pt: `<b>[Passiva — ${this.name}]</b> O <b>CLAIM</b> de ${formatChampionName(actionSource)} atrai a luz de Selina — <b>${this.claimShieldAmount}</b> de Escudo concedido.`,
      },
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
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} answers for ${formatChampionName(defender)} — her blade opens ${formatChampionName(attacker)} for <b>${this.riposteDamage}</b>.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} responde por ${formatChampionName(defender)} — sua lâmina fere ${formatChampionName(attacker)} em <b>${this.riposteDamage}</b>.`,
      },
    };
  },
};
