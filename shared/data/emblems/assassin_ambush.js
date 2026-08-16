// shared/data/emblems/assassin_ambush.js

function isAssassin(champion) {
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
    if (normalized === "assassin") return true;
  }
  return false;
}

export const assassinAmbush = {
  key: "assassin_ambush",
  name: "Emblem of the Silent Blade",

  requirements: {
    classKey: {
      key: "assassin",
      count: 4,
    },
  },

  description() {
    return "Your Assassin class champions gain +15 Speed and +10% Critical Chance.";
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
      if (!isAssassin(champion)) continue;
      if (champion.runtime?._assassinAmbushApplied) continue;

      if (!champion.runtime) champion.runtime = {};
      champion.runtime._assassinAmbushApplied = true;

      if (champion.modifyStat) {
        champion.modifyStat({
          statName: "Speed",
          amount: 15,
          context,
          isPermanent: true,
        });
        champion.modifyStat({
          statName: "Critical",
          amount: 10,
          context,
          isPermanent: true,
        });
      }
    }
  },
};
