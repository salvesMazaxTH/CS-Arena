import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "redline_rapture",
  name: "Redline Rapture",

  attackPerRecoil: 20,

  description() {
    return `Irina's own fire was always a weak, useless little thing that burned her more than it ever helped anyone else — until the flamethrower gave it teeth, at the cost of running hot enough to bite back at her too. She doesn't mind. Every time the gun kicks back, she laughs harder and hits harder: +${this.attackPerRecoil} permanent Attack.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  // The recoil fires at depth 1; the engine blocks reactive hooks on nested
  // damage by default, so opt back in.
  hookPolicies: {
    onAfterDmgTaking: {
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ owner, skill, context }) {
    if (skill?.key !== "weapon_overheat") return;

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
