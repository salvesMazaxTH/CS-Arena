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

// One entry per requirement kind: where its target sits in the emblem data and
// whether a champion satisfies it. An emblem may combine several kinds, and
// every one of them must pass.
export const EMBLEM_REQUIREMENT_KINDS = Object.freeze([
  {
    kind: "elementalAffinity",
    readTarget: (requirement) => requirement.element,
    matches: (champion, element) => championHasAffinity(champion, element),
  },
  {
    kind: "species",
    readTarget: (requirement) => requirement.species,
    matches: (champion, species) => championHasSpecies(champion, species),
  },
  {
    kind: "classKey",
    readTarget: (requirement) => requirement.key,
    matches: (champion, classKey) => championHasClass(champion, classKey),
  },
  {
    // Not used by any emblem yet: `min` is optional, so a bare stat only asks
    // that the champion has it.
    kind: "baseStat",
    readTarget: (requirement) => requirement.stat,
    readThreshold: (requirement) => requirement.min,
    matches: (champion, stat, min) => {
      const value = Number(champion[stat]);
      if (!Number.isFinite(value)) return false;
      return min == null || value >= Number(min);
    },
  },
]);

/**
 * An emblem's requirements flattened into `{ descriptor, target, threshold,
 * required }` entries. classKey is a list, so it yields one entry per class.
 */
export function readEmblemRequirements(requirements) {
  if (!requirements || typeof requirements !== "object") return [];

  return EMBLEM_REQUIREMENT_KINDS.flatMap((descriptor) => {
    const requirement = requirements[descriptor.kind];
    if (!requirement) return [];

    const entries = Array.isArray(requirement) ? requirement : [requirement];

    return entries.map((entry) => {
      // baseStat names a stat field (case-sensitive); the others a lowercase key.
      const rawTarget = String(descriptor.readTarget(entry) ?? "").trim();
      return {
        descriptor,
        target:
          descriptor.kind === "baseStat" ? rawTarget : rawTarget.toLowerCase(),
        threshold: descriptor.readThreshold?.(entry) ?? null,
        required: Number(entry.count || 0),
      };
    });
  });
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
 * Every requirement of an emblem paired with what the roster brings to it.
 * Each entry carries its `descriptor`, `target`, `threshold`, `required`
 * count, the `actual` count and whether it passes. classKey yields one entry
 * per class, counted by slot matching.
 */
export function countEmblemRequirements(emblem, roster = []) {
  const classCounts = countClassRequirementSlots(
    readClassRequirements(emblem?.requirements),
    roster,
  );
  let classIndex = 0;

  return readEmblemRequirements(emblem?.requirements).map((entry) => {
    const actual =
      entry.descriptor.kind === "classKey"
        ? classCounts[classIndex++]
        : roster.filter((champion) =>
            entry.descriptor.matches(champion, entry.target, entry.threshold),
          ).length;
    return { ...entry, actual, pass: actual >= entry.required };
  });
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
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);
  return countEmblemRequirements(emblem, roster).every((check) => check.pass);
}
