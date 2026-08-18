// shared/data/emblems/ocean_grace.js

export const oceanGrace = {
  key: "ocean_grace",
  name: "Emblem of the Ocean's Grace",

  healingMultiplier: 1.30,
  maxHPBonusPercent: 0.05,

  requirements: {
    elementalAffinity: {
      element: "water",
      count: 3,
    },
  },

  description() {
    const healingBonus = Math.round(
      (this.healingMultiplier - 1) * 100,
    );

    const maxHPBonus = Math.round(
      this.maxHPBonusPercent * 100,
    );

    return `Increases all healing performed or received by your team by +${healingBonus}% and grants +${maxHPBonus}% bonus Max HP to allied champions when entering combat.`;
  },

  hookScope: {
    onChampionAdded: "owner",
    onBeforeHealing: "owner",
  },

  onChampionAdded({ owner, context }) {
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;

    // Check if already applied to this champion
    if (owner.runtime?._oceanGraceApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._oceanGraceApplied = true;

    // +5% do Max HP que o campeão possui ao entrar em campo.
    const hpBonus = Math.max(
      1,
      Math.round(
        (owner.maxHP || owner.baseHP || 100) *
          this.maxHPBonusPercent,
      ),
    );

    if (owner.modifyHP) {
      owner.modifyHP(hpBonus, {
        affectMax: true,
        isPermanent: true,
        context,
      });
    } else {
      owner.maxHP = (owner.maxHP || 0) + hpBonus;
      owner.HP = Math.min(
        (owner.HP || 0) + hpBonus,
        owner.maxHP,
      );
    }
  },

  onBeforeHealing({ source, target, amount, owner }) {
    if (!amount || amount <= 0) return;

    if (
      source?.team === owner?.team ||
      target?.team === owner?.team
    ) {
      return {
        amount: Math.round(
          amount * this.healingMultiplier,
        ),
      };
    }
  },
};