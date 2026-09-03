import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "redline_rapture",
  name: "Redline Rapture",

  attackPerRecoil: 20,
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
    return `Irina's own fire was always a weak, useless little thing that burned her more than it ever helped anyone else — until the flamethrower gave it teeth, at the cost of running hot enough to bite back at her too. She doesn't mind. Every time the gun kicks back, she laughs harder and hits harder: +${this.attackPerRecoil} permanent Attack. Even a CLAIM keeps the redline lit: +${this.attackPerClaim} permanent Attack, up to +${this.claimAttackCap} from CLAIMs.`;
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
      log: `<b>[Passive — Redline Rapture]</b> ${formatChampionName(owner)} keeps the redline lit through the CLAIM (+${amount} permanent Attack).`,
    };
  },

  // The recoil fires at depth 1; the engine blocks reactive hooks on nested
  // damage by default, so opt back in.
  hookPolicies: {
    onAfterDmgTaking: {
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ owner, hitId, context }) {
    if (hitId !== "overheat") return;

    owner.modifyStat({
      statName: "Attack",
      amount: this.attackPerRecoil,
      context,
      isPermanent: true,
      statModifierSrc: owner,
    });

    return {
      log: `<b>[Passive — Redline Rapture]</b> ${formatChampionName(owner)} laughs straight through the burn (+${this.attackPerRecoil} permanent Attack).`,
    };
  },
};
