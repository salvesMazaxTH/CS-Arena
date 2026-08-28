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

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;

    // Check if already applied to this champion
    if (champion.runtime?._oceanGraceApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._oceanGraceApplied = true;

    // +5% of the Max HP the champion has when entering the field.
    const hpBonus = Math.max(
      1,
      Math.round(
        (champion.maxHP || champion.baseHP || 100) *
          this.maxHPBonusPercent,
      ),
    );

    if (champion.modifyHP) {
      champion.modifyHP(hpBonus, {
        affectMax: true,
        isPermanent: true,
        context,
      });
    } else {
      champion.maxHP = (champion.maxHP || 0) + hpBonus;
      champion.HP = Math.min(
        (champion.HP || 0) + hpBonus,
        champion.maxHP,
      );
    }
  },

  onBeforeHealing({ healSrc, healTarget, amount, owner }) {
    if (!amount || amount <= 0) return;

    if (
      healSrc?.team === owner?.team ||
      healTarget?.team === owner?.team
    ) {
      return {
        amount: Math.round(
          amount * this.healingMultiplier,
        ),
      };
    }
  },
};