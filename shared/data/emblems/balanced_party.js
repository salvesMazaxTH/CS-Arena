// shared/data/emblems/balanced_party.js

import { countClassRequirementSlots } from "./eligibility.js";

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
      en: `The oldest party there is: a shield up front, a hand at the back keeping everyone standing, and the spells that end the fight. Each champion fills a single role, so one champion never counts toward two classes. While at least one allied Tank, Enchanter and Mage — three different champions — stand on the field together, every allied champion deals <b>${this.damageBonusPercent}%</b> increased damage and takes <b>${this.damageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>).`,
      pt: `A formação mais antiga que existe: um escudo na frente, uma mão lá atrás mantendo todos de pé e os feitiços que encerram a luta. Cada campeão ocupa um único papel, então nenhum campeão conta para duas classes. Enquanto ao menos um Tanque, um Encantador e um Mago aliados — três campeões diferentes — estiverem juntos em campo, todo campeão aliado causa dano <b>${this.damageBonusPercent}%</b> maior e sofre <b>${this.damageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>).`,
    };
  },

  hookPolicies: {
    onBeforeDmgDealing: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, owner, damage, context }) {
    if (!attacker || !owner || attacker.team !== owner.team) return;
    if (!(damage > 0) || !this._partyStands(owner.team, context)) return;

    return { damage: damage * (1 + this.damageBonusPercent / 100) };
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (!defender || !owner || defender.team !== owner.team) return;
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
