// shared/data/champions/aren_marevoth/tide.js

export const TIDE_HOOK_KEY = "marevoth_tide";

/**
 * Get current Tide stacks on a champion from runtime.hookEffects
 * @param {object} champion
 * @returns {number}
 */
export function getTideStacks(champion) {
  if (!Array.isArray(champion?.runtime?.hookEffects)) return 0;
  const hook = champion.runtime.hookEffects.find(
    (he) => he.key === TIDE_HOOK_KEY,
  );
  return hook?.stacks ?? 0;
}

/**
 * Apply 1 stack of Tide to a target champion via runtime.hookEffects
 * @param {object} target
 */
export function applyTide(target) {
  target.runtime ??= {};
  target.runtime.hookEffects ??= [];

  let hook = target.runtime.hookEffects.find(
    (he) => he.key === TIDE_HOOK_KEY,
  );

  if (hook) {
    hook.stacks = (hook.stacks || 0) + 1;
  } else {
    target.runtime.hookEffects.push({
      key: TIDE_HOOK_KEY,
      name: "Tide",
      group: "marevoth_tide",
      stacks: 1,
    });
  }
}

/**
 * Consume and remove all Tide stacks from a target champion
 * @param {object} target
 * @returns {number} Number of stacks consumed
 */
export function consumeTide(target) {
  if (!Array.isArray(target?.runtime?.hookEffects)) return 0;

  const hookIndex = target.runtime.hookEffects.findIndex(
    (he) => he.key === TIDE_HOOK_KEY,
  );

  if (hookIndex === -1) return 0;

  const stacks = target.runtime.hookEffects[hookIndex].stacks ?? 1;
  target.runtime.hookEffects.splice(hookIndex, 1);

  return stacks;
}
