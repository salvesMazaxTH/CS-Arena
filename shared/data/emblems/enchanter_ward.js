// shared/data/emblems/enchanter_ward.js

function isEnchanter(champion) {
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
    if (normalized === "enchanter") return true;
  }
  return false;
}

export const enchanterWard = {
  key: "enchanter_ward",
  name: "Emblem of Mystic Sanctuary",

  requirements: {
    classKey: {
      key: "enchanter",
      count: 4,
    },
  },

  description() {
    return "Your Enchanter class champions gain +10 Evasion and their healing effectiveness is increased by +15%.";
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
      if (!isEnchanter(champion)) continue;
      if (champion.runtime?._enchanterWardApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._enchanterWardApplied = true;

      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Evasion",
          amount: 10,
          context,
          isPermanent: true,
        });
      }
    }
  },

  onBeforeHealing({ source, amount, owner }) {
    if (!amount || amount <= 0) return;
    if (source?.team !== owner?.team) return;
    if (!isEnchanter(source)) return;

    return {
      amount: Math.round(amount * 1.15),
    };
  },
};
