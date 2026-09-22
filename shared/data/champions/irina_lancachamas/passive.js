import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "redline_rapture",
  name: "Redline Rapture",

  attackPerRecoil: 15,
  attackPerClaim: 10,
  claimAttackCap: 40,

  hits: [
    {
      id: "overheat",
      label: "Weapon Overheat",
      type: "magical",
      contact: false,
      damageMode: "absolute",
      suppressLog: true,
    },
  ],

  description() {
    return {
      en: `Irina's own fire was always a weak, useless little thing that burned her more than it ever helped anyone else — until the flamethrower gave it teeth, at the cost of running hot enough to bite back at her too. She doesn't mind. Every time the gun kicks back, she laughs harder and hits harder: <b>+${this.attackPerRecoil}</b> permanent <b>Attack</b>. Even a <b>CLAIM</b> keeps the redline lit: <b>+${this.attackPerClaim}</b> permanent <b>Attack</b>, up to <b>+${this.claimAttackCap}</b> from CLAIMs.`,
      pt: `O próprio fogo de Irina sempre foi uma coisinha fraca e inútil, que a queimava mais do que jamais ajudou alguém — até o lança-chamas lhe dar dentes, ao custo de esquentar o bastante para morder de volta. Ela não se importa. Toda vez que a arma dá coice, ela ri mais alto e bate mais forte: <b>+${this.attackPerRecoil}</b> de <b>Ataque</b> permanente. Até um <b>CLAIM</b> mantém a linha vermelha acesa: <b>+${this.attackPerClaim}</b> de <b>Ataque</b> permanente, até <b>+${this.claimAttackCap}</b> vindo de CLAIMs.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    owner.runtime ??= {};
    const gained = owner.runtime.redlineClaimAttack ?? 0;
    if (gained >= this.claimAttackCap) return;

    const amount = Math.min(this.attackPerClaim, this.claimAttackCap - gained);
    owner.runtime.redlineClaimAttack = gained + amount;

    owner.modifyStat({
      statName: "Attack",
      amount,
      context,
      isPermanent: true,
      statModifierSrc: owner,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} keeps the redline lit through the CLAIM (+${amount} permanent Attack).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} mantém a linha vermelha acesa através do CLAIM (+${amount} de Ataque permanente).`,
      },
    };
  },

  // The recoil fires at depth 1; the engine blocks reactive hooks on nested
  // damage by default, so opt back in.
  hookPolicies: {
    onAfterDmgTaking: {
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ owner, hitId, actualDmg, context }) {
    if (hitId !== "overheat" || !(actualDmg > 0)) return;

    owner.modifyStat({
      statName: "Attack",
      amount: this.attackPerRecoil,
      context,
      isPermanent: true,
      statModifierSrc: owner,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} laughs straight through the burn (+${this.attackPerRecoil} permanent Attack).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} ri direto através da queimadura (+${this.attackPerRecoil} de Ataque permanente).`,
      },
    };
  },
};
