export default {
  key: "flawseeking_sight",
  name: "Flawseeking Sight",

  // Critical scaling.
  critPerHit: 3,

  // Overflow-to-damage conversion.
  critConversionThreshold: 55,
  critOverflowToDamage: 1.2,

  // Flat bonus on critical hits.
  critBonusFlat: 35,

  description() {
    return `
    Myrra reads every guard she strikes, and each attack permanently sharpens her Critical chance by +${this.critPerHit}%.

    Once her Critical rises past ${this.critConversionThreshold}%, there is nothing left to learn: the excess becomes bonus damage instead (${this.critOverflowToDamage * 100}% of the overflow).

    Her critical hits carry +${this.critBonusFlat} bonus damage.
    `;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, context }) {
    owner.modifyStat({
      statName: "Critical",
      amount: this.critPerHit,
      context,
      isPermanent: true,
    });
  },

  onBeforeDmgDealing({ owner, damage, crit }) {
    let bonusDamage = 0;

    // Convert excess Critical into bonus damage.
    if (owner.Critical > this.critConversionThreshold) {
      const overflow = owner.Critical - this.critConversionThreshold;
      bonusDamage += overflow * this.critOverflowToDamage;
    }

    // Flat bonus when the hit crits.
    if (crit?.didCrit) {
      bonusDamage += this.critBonusFlat;
    }

    if (bonusDamage <= 0) return;

    return {
      damage: damage + bonusDamage,
    };
  },
};
