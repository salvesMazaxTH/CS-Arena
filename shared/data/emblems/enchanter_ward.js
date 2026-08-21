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

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!isEnchanter(champion)) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._enchanterWardApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._enchanterWardApplied = true;

    // Apply buff only to this specific champion
    if (champion.modifyStat) {
      champion.modifyStat({
        statName: "Evasion",
        amount: 10,
        context,
        isPermanent: true,
      });
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
