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

  bonusDamage: 20,

  description() {
    return `Skill attacks used by your Mage class champions deal ${this.bonusDamage} bonus damage.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, skill, owner }) {
    if (!attacker || !skill) return;
    if (attacker.team !== owner?.team) return;
    if (!isMage(attacker)) return;

    return {
      bonusDamage: this.bonusDamage,
    };
  },
};
