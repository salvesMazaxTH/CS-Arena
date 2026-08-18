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
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;
    if (!isMarksman(owner)) return;

    // Mark that this champion has already received the emblem buff
    if (owner.runtime?._marksmanPrecisionApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._marksmanPrecisionApplied = true;

    // Apply buff only to this specific champion
    if (owner.modifyStat) {
      owner.modifyStat({
        statName: "Attack",
        amount: 20,
        context,
        isPermanent: true,
      });
      owner.modifyStat({
        statName: "Critical",
        amount: 8,
        context,
        isPermanent: true,
      });
    }
  },
};
