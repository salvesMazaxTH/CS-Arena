// shared/data/emblems/silent_blade.js

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

export const silentBlade = {
  key: "silent_blade",
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
    // Only apply buff to the champion being added
    if (!owner || owner.team == null) return;
    if (!isAssassin(owner)) return;

    // Mark that this champion has already received the emblem buff
    if (owner.runtime?._silentBladeApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._silentBladeApplied = true;

    // Apply buff only to this specific champion
    if (owner.modifyStat) {
      owner.modifyStat({
        statName: "Speed",
        amount: 15,
        context,
        isPermanent: true,
      });
      owner.modifyStat({
        statName: "Critical",
        amount: 10,
        context,
        isPermanent: true,
      });
    }
  },
};
