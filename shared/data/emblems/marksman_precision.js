// shared/data/emblems/marksman_precision.js

function isMarksman(champion) {
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
    if (normalized === "marksman") return true;
  }
  return false;
}

export const marksmanPrecision = {
  key: "marksman_precision",
  name: "Emblem of Deadeye Precision",

  requirements: {
    classKey: {
      key: "marksman",
      count: 4,
    },
  },

  description() {
    return "Your Marksman class champions gain +20 Attack and +8% Critical Chance.";
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
      if (!isMarksman(champion)) continue;
      if (champion.runtime?._marksmanPrecisionApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._marksmanPrecisionApplied = true;

      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Attack",
          amount: 20,
          context,
          isPermanent: true,
        });
        champion.modifyStat({
          statName: "Critical",
          amount: 8,
          context,
          isPermanent: true,
        });
      }
    }
  },
};
