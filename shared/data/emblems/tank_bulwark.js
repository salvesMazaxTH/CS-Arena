// shared/data/emblems/tank_bulwark.js

function isTank(champion) {
  if (!champion) return false;
  const candidates = [
    champion.classKey,
    champion.classTag,
    champion.role,
    champion.archetype,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.replace(/^class\s*:\s*/i, "").trim().toLowerCase();
    if (normalized === "tank") return true;
  }
  return false;
}

export const tankBulwark = {
  key: "tank_bulwark",
  name: "Emblem of the Titan's Bulwark",

  requirements: {
    classKey: {
      key: "tank",
      count: 5,
    },
  },

  description() {
    return "Your Tank class champions gain +30 Defense and +5% Max HP.";
  },

  hookScope: {
    onChampionAdded: "owner",
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
      if (!isTank(champion)) continue;
      if (champion.runtime?._tankBulwarkApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._tankBulwarkApplied = true;

      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Defense",
          amount: 30,
          context,
          isPermanent: true,
        });
      }

      const hpBonus = Math.max(1, Math.round((champion.maxHP || 100) * 0.05));
      if (champion.modifyHP) {
        champion.modifyHP(hpBonus, {
          affectMax: true,
          isPermanent: true,
          context,
        });
      } else {
        champion.maxHP = (champion.maxHP || 0) + hpBonus;
        champion.HP = Math.min((champion.HP || 0) + hpBonus, champion.maxHP);
      }
    }
  },
};
