// shared/data/emblems/mage_arcana.js

function isMage(champion) {
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
    if (normalized === "mage") return true;
  }
  return false;
}

export const mageArcana = {
  key: "mage_arcana",
  name: "Emblem of High Arcana",

  requirements: {
    classKey: {
      key: "mage",
      count: 5,
    },
  },

  description() {
    return "Skill attacks used by your Mage class champions deal +20 additional damage.";
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, skill, damage, owner }) {
    if (!attacker || !skill) return;
    if (attacker.team !== owner?.team) return;
    if (!isMage(attacker)) return;

    const newDamage = Number(damage) + 20;

    return {
      damage: newDamage,
    };
  },
};
