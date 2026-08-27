// shared/data/emblems/assassins_ambush.js

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

export const assassinsAmbush = {
  key: "assassins_ambush",
  name: "Emblem of the Assassin's Ambush",
  piercingPercentage: 25,

  requirements: {
    classKey: {
      key: "assassin",
      count: 5,
    },
  },

  description() {
    return `Your Assassin class champions' attacks always deal Piercing Damage, ignoring an extra ${this.piercingPercentage}% of the target's Defense on top of any Piercing the hit already carries.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, owner, mode, piercingPercentage }) {
    if (!attacker || !owner || attacker.team !== owner.team) return;
    if (!isAssassin(attacker)) return;

    // Absolute damage already ignores Defense entirely — never downgrade it.
    if (mode === "absolute") return;

    const current = mode === "piercing" ? Number(piercingPercentage || 0) : 0;
    const total = Math.min(100, current + this.piercingPercentage);

    return {
      mode: "piercing",
      piercingPercentage: total,
      log: `<b>[Emblem — Assassin's Ambush]</b> ${defender?.name ?? "the target"} is caught in the ambush: the strike ignores ${total}% of their Defense.`,
    };
  },
};
