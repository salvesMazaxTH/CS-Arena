// Emblem eligibility: whether a roster satisfies an emblem's requirements.
// championDB is injected so this module stays decoupled from the data layer.

/** Champion species as a normalized lowercase list, from either shape it may take. */
function getChampionSpecies(champion) {
  if (!champion) return [];

  if (Array.isArray(champion.species)) {
    return champion.species
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof champion.speciesTag === "string") {
    return champion.speciesTag
      .replace(/^species\s*:\s*/i, "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

/** First class-like tag on the champion, normalized, or null. */
function normalizeChampionClassKey(champion) {
  if (!champion) return null;

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
    if (normalized) return normalized;
  }

  return null;
}

/**
 * True when every requirement of `emblem` is met by the champions in `rosterKeys`.
 * An emblem with no requirements is always eligible.
 */
export function evaluateEmblemEligibilityForRoster(
  emblem,
  rosterKeys = [],
  championDB = {},
) {
  if (!emblem || !emblem.requirements) return true;

  const requirements = emblem.requirements;
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const checks = [];

  if (requirements.elementalAffinity) {
    const targetElement = String(requirements.elementalAffinity.element || "")
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.elementalAffinity.count || 0);
    const actualCount = roster.filter((champion) => {
      const affinities = Array.isArray(champion.elementalAffinities)
        ? champion.elementalAffinities
        : typeof champion.elementalAffinities === "string"
          ? [champion.elementalAffinities]
          : [];
      return affinities.some(
        (affinity) => String(affinity).trim().toLowerCase() === targetElement,
      );
    }).length;
    checks.push(actualCount >= requiredCount);
  }

  if (requirements.species) {
    const targetSpecies = String(
      requirements.species.value ??
        requirements.species.species ??
        requirements.species.key ??
        "",
    )
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.species.count || 0);
    const actualCount = roster.filter((champion) =>
      getChampionSpecies(champion).includes(targetSpecies),
    ).length;
    checks.push(actualCount >= requiredCount);
  }

  if (requirements.classKey) {
    const targetClass = String(
      requirements.classKey.value ??
        requirements.classKey.class ??
        requirements.classKey.key ??
        "",
    )
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.classKey.count || 0);
    const actualCount = roster.filter(
      (champion) => normalizeChampionClassKey(champion) === targetClass,
    ).length;
    checks.push(actualCount >= requiredCount);
  }

  if (requirements.baseStat) {
    const statKey = String(
      requirements.baseStat.stat ??
        requirements.baseStat.key ??
        requirements.baseStat.name ??
        "",
    ).trim();
    const requiredCount = Number(requirements.baseStat.count || 0);
    const threshold =
      requirements.baseStat.min ??
      requirements.baseStat.value ??
      requirements.baseStat.threshold;

    const actualCount = roster.filter((champion) => {
      const value = Number(champion[statKey]);
      if (!Number.isFinite(value)) return false;
      if (threshold == null) return true;
      return value >= Number(threshold);
    }).length;

    checks.push(actualCount >= requiredCount);
  }

  return checks.length === 0 || checks.every(Boolean);
}
