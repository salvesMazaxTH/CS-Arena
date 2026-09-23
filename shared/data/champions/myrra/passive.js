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
    return {
      en: `Myrra reads every guard she strikes, and each attack permanently sharpens her <b>Critical</b> chance by <b>+${this.critPerHit}%</b>.

      Once her <b>Critical</b> rises past <b>${this.critConversionThreshold}%</b>, there is nothing left to learn: the excess becomes bonus damage instead (<b>${this.critOverflowToDamage * 100}%</b> of the overflow).

      Her critical hits carry <b>+${this.critBonusFlat}</b> bonus damage.`,
      pt: `Myrra lê cada guarda que atinge, e cada ataque afia permanentemente sua chance de <b>Crítico</b> em <b>+${this.critPerHit}%</b>.

      Quando seu <b>Crítico</b> ultrapassa <b>${this.critConversionThreshold}%</b>, não sobra mais nada a aprender: o excedente vira dano bônus (<b>${this.critOverflowToDamage * 100}%</b> do excesso).

      Seus acertos críticos carregam <b>+${this.critBonusFlat}</b> de dano bônus.`,
    };
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

  onBeforeDmgDealing({ owner, crit }) {
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

    return { bonusDamage };
  },
};
