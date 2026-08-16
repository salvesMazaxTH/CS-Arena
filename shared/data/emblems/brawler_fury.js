// shared/data/emblems/brawler_fury.js

function isBrawler(champion) {
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
    if (normalized === "brawler" || normalized === "bralwer") return true;
  }
  return false;
}

export const brawlerFury = {
  key: "brawler_fury",
  name: "Emblem of the Apex Brawler",

  requirements: {
    classKey: {
      key: "brawler",
      count: 4,
    },
  },

  description() {
    return "Your Brawler class champions gain +15 Attack and +5% Critical Chance.";
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
      if (!isBrawler(champion)) continue;
      if (champion.runtime?._brawlerFuryApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._brawlerFuryApplied = true;

      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Attack",
          amount: 15,
          context,
          isPermanent: true,
        });
        champion.modifyStat({
          statName: "Critical",
          amount: 5,
          context,
          isPermanent: true,
        });
      }
    }
  },
};
