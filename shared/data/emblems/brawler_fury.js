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

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!isBrawler(champion)) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._brawlerFuryApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._brawlerFuryApplied = true;

    // Apply buff only to this specific champion
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
  },
};
