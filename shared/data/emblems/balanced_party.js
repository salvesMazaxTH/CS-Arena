// shared/data/emblems/balanced_party.js

import { countClassRequirementSlots } from "./eligibility.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const balancedParty = {
  key: "balanced_party",
  name: "Emblem of the Balanced Party",

  damageBonusPercent: 10,
  damageReductionPercent: 10,
  // One distinct living champion per role must be on the field for the bonus.
  fieldTrio: [
    { key: "tank", count: 1 },
    { key: "enchanter", count: 1 },
    { key: "mage", count: 1 },
  ],

  requirements: {
    classKey: [
      { key: "tank", count: 2 },
      { key: "enchanter", count: 2 },
      { key: "mage", count: 3 },
    ],
  },

  description() {
    return {
      en: `While your team has a living Tank, Enchanter and Mage on the field (three different champions), your champions deal <b>${this.damageBonusPercent}%</b> increased damage and take <b>${this.damageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>).`,
      pt: `Enquanto seu time tiver um Tanque, um Encantador e um Mago vivos em campo (três campeões diferentes), seus campeões causam dano <b>${this.damageBonusPercent}%</b> maior e sofrem <b>${this.damageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>).`,
    };
  },

  hookPolicies: {
    onBeforeDmgDealing: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, owner, damage, context }) {
    if (!attacker || !owner || !isEmblemBeneficiary(attacker, owner)) return;
    if (!(damage > 0) || !this._partyStands(owner.team, context)) return;

    return { damage: damage * (1 + this.damageBonusPercent / 100) };
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (!defender || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (!(damage > 0) || !this._partyStands(owner.team, context)) return;

    return { damage: damage * (1 - this.damageReductionPercent / 100) };
  },

  _partyStands(team, context) {
    const field = context?.allChampions;
    const champions =
      field instanceof Map ? [...field.values()] : Array.isArray(field) ? field : [];

    const party = champions.filter(
      (champion) =>
        champion?.alive &&
        champion.team === team &&
        champion.entityType === "champion",
    );

    const counts = countClassRequirementSlots(this.fieldTrio, party);
    return this.fieldTrio.every((role, index) => counts[index] >= role.count);
  },
};
