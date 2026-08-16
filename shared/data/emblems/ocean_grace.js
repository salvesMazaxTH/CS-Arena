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
    if (!owner?.team) return;

    const allChampions =
      context?.allChampions instanceof Map
        ? [...context.allChampions.values()]
        : Array.isArray(context?.allChampions)
          ? context.allChampions
          : [];

    for (const champion of allChampions) {
      if (!champion || champion.team !== owner.team) continue;
      if (champion.runtime?._oceanGraceApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._oceanGraceApplied = true;

      // +5% do Max HP que o campeão possui ao entrar em campo.
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