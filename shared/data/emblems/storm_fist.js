// shared/data/emblems/storm_fist.js
//
// First mixed emblem: it asks for two different requirement kinds at once
// (a class and an elemental affinity), so both checks must pass to unlock it.
// Both halves of the roster are rewarded — the Speed grant is just tuned per
// half, since Lightning champions are already fast and Brawlers usually are not.

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
    const normalized = candidate
      .replace(/^class\s*:\s*/i, "")
      .trim()
      .toLowerCase();
    if (normalized === "brawler") return true;
  }
  return false;
}

function hasLightningAffinity(champion) {
  const affinities = Array.isArray(champion?.elementalAffinities)
    ? champion.elementalAffinities
    : typeof champion?.elementalAffinities === "string"
      ? [champion.elementalAffinities]
      : [];
  return affinities.some(
    (affinity) => String(affinity).trim().toLowerCase() === "lightning",
  );
}

// Speed granted to each half of the emblem, keyed by the test that qualifies a
// champion for it. A champion that is both takes the higher grant, not the sum.
const SPEED_GRANTS = [
  { matches: isBrawler, amount: 12 },
  { matches: hasLightningAffinity, amount: 5 },
];

function getSpeedGrant(champion) {
  const amounts = SPEED_GRANTS.filter((grant) => grant.matches(champion)).map(
    (grant) => grant.amount,
  );
  return amounts.length ? Math.max(...amounts) : 0;
}

function carriesTheStorm(champion) {
  return isBrawler(champion) || hasLightningAffinity(champion);
}

export const stormFist = {
  key: "storm_fist",
  name: "Emblem of the Storm Fist",
  bonusDmgPercent: 15,

  requirements: {
    classKey: {
      key: "brawler",
      count: 3,
    },
    elementalAffinity: {
      element: "lightning",
      count: 2,
    },
  },

  description() {
    const [brawlerGrant, lightningGrant] = SPEED_GRANTS.map(
      (grant) => grant.amount,
    );
    return `Your Brawler champions gain +${brawlerGrant} Speed and your Lightning champions gain +${lightningGrant} Speed when entering combat. Both deal ${this.bonusDmgPercent}% bonus damage to enemies slower than them.`;
  },

  hookScope: {
    onChampionAdded: "owner",
    onBeforeDmgDealing: "attacker",
  },

  onChampionAdded({ owner, context }) {
    if (!owner || owner.team == null) return;

    const speedBonus = getSpeedGrant(owner);
    if (!speedBonus) return;

    // Mark that this champion has already received the emblem buff
    if (owner.runtime?._stormFistApplied) return;

    if (!owner.runtime) owner.runtime = {};
    owner.runtime._stormFistApplied = true;

    if (owner.modifyStat) {
      owner.modifyStat({
        statName: "Speed",
        amount: speedBonus,
        context,
        isPermanent: true,
      });
    }
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;

    if (attacker.team !== owner.team) return;

    // Either half of the emblem carries the storm.
    if (!carriesTheStorm(attacker)) return;

    // The strike only lands as a storm on those it can outpace.
    if (Number(attacker.Speed) <= Number(defender.Speed)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    console.log("[STORM FIST - Outpaced] Bonus applied:", {
      attacker: attacker?.name,
      defender: defender?.name,
      attackerSpeed: attacker?.Speed,
      defenderSpeed: defender?.Speed,
      before: damage,
      bonus: bonusDamage.toFixed(2),
      after: newDamage.toFixed(2),
    });

    return {
      damage: newDamage,
    };
  },
};
