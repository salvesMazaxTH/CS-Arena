// Emblem eligibility: whether a roster satisfies an emblem's requirements.
// championDB is injected so this module stays decoupled from the data layer.

import { championHasClass } from "../championClasses.js";

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

/** An emblem's class requirements as `{ key, count }` entries, keys lowercased. */
export function readClassRequirements(requirements) {
  const entries = requirements?.classKey;
  if (!Array.isArray(entries)) return [];

  return entries.map((entry) => ({
    key: String(entry.key || "").trim().toLowerCase(),
    count: Number(entry.count || 0),
  }));
}

/**
 * How many champions each class requirement gets when every champion fills at
 * most one slot, so a dual-class champion counts toward one class, never two.
 * Slots are assigned by maximum matching; champions left unassigned still add
 * to every class they hold, which can only happen once that class is full.
 */
export function countClassRequirementSlots(classRequirements, roster) {
  const slots = classRequirements.flatMap((requirement, index) =>
    Array.from({ length: requirement.count }, () => index),
  );
  const slotHolder = new Array(slots.length).fill(-1);

  const tryAssign = (championIndex, visited) => {
    const champion = roster[championIndex];

    for (let slot = 0; slot < slots.length; slot += 1) {
      if (visited[slot]) continue;
      if (!championHasClass(champion, classRequirements[slots[slot]].key)) continue;
      visited[slot] = true;

      if (slotHolder[slot] < 0 || tryAssign(slotHolder[slot], visited)) {
        slotHolder[slot] = championIndex;
        return true;
      }
    }

    return false;
  };

  roster.forEach((_, championIndex) =>
    tryAssign(championIndex, new Array(slots.length).fill(false)),
  );

  const counts = classRequirements.map(() => 0);
  slotHolder.forEach((holder, slot) => {
    if (holder >= 0) counts[slots[slot]] += 1;
  });

  const assigned = new Set(slotHolder);
  roster.forEach((champion, championIndex) => {
    if (assigned.has(championIndex)) return;
    classRequirements.forEach((requirement, index) => {
      if (championHasClass(champion, requirement.key)) counts[index] += 1;
    });
  });

  return counts;
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
    const classRequirements = readClassRequirements(requirements);
    const counts = countClassRequirementSlots(classRequirements, roster);
    classRequirements.forEach((requirement, index) =>
      checks.push(counts[index] >= requirement.count),
    );
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
