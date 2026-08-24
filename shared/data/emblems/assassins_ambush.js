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
    return `Your Assassin class champions' attacks always deal Piercing Damage, ignoring at least ${this.piercingPercentage}% of the target's Defense.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, owner, mode, piercingPercentage }) {
    if (!attacker || !owner || attacker.team !== owner.team) return;
    if (!isAssassin(attacker)) return;

    // Absolute damage already ignores Defense entirely — never downgrade it.
    // A stronger existing pierce also stands, since this is meant as a floor.
    if (mode === "absolute") return;
    if (mode === "piercing" && Number(piercingPercentage || 0) >= this.piercingPercentage) {
      return;
    }

    return {
      mode: "piercing",
      piercingPercentage: this.piercingPercentage,
      log: `<b>[Emblem — Assassin's Ambush]</b> ${defender?.name ?? "the target"} is caught in the ambush: the strike ignores ${this.piercingPercentage}% of their Defense.`,
    };
  },
};
