// Emblem eligibility: whether a roster satisfies an emblem's requirements.
// championDB is injected so this module stays decoupled from the data layer.

import { championHasClass } from "../championClasses.js";
import { championHasAffinity, championHasSpecies } from "../championTraits.js";

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
    const { element, count } = requirements.elementalAffinity;
    const actualCount = roster.filter((champion) =>
      championHasAffinity(champion, element),
    ).length;
    checks.push(actualCount >= count);
  }

  if (requirements.species) {
    const { species, count } = requirements.species;
    const actualCount = roster.filter((champion) =>
      championHasSpecies(champion, species),
    ).length;
    checks.push(actualCount >= count);
  }

  if (requirements.classKey) {
    const classRequirements = readClassRequirements(requirements);
    const counts = countClassRequirementSlots(classRequirements, roster);
    classRequirements.forEach((requirement, index) =>
      checks.push(counts[index] >= requirement.count),
    );
  }

  // Not used by any emblem yet: `min` is optional, so a bare stat only asks
  // that the champion has it.
  if (requirements.baseStat) {
    const { stat, min, count } = requirements.baseStat;
    const actualCount = roster.filter((champion) => {
      const value = Number(champion[stat]);
      if (!Number.isFinite(value)) return false;
      return min == null || value >= min;
    }).length;
    checks.push(actualCount >= count);
  }

  return checks.length === 0 || checks.every(Boolean);
}
