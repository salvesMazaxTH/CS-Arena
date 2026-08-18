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
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;
    if (!isBrawler(owner)) return;

    // Mark that this champion has already received the emblem buff
    if (owner.runtime?._brawlerFuryApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._brawlerFuryApplied = true;

    // Apply buff only to this specific champion
    if (owner.modifyStat) {
      owner.modifyStat({
        statName: "Attack",
        amount: 15,
        context,
        isPermanent: true,
      });
      owner.modifyStat({
        statName: "Critical",
        amount: 5,
        context,
        isPermanent: true,
      });
    }
  },
};
