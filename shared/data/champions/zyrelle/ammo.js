// Shared revolver-ammo state for Zyrelle. Used by both her passive (which owns
// the reload rules and description) and her skills (which spend rounds), so it
// lives here instead of being duplicated across files.

export const MAX_AMMO = 6;
export const IDLE_RELOAD = 3;

export function getAmmo(champion) {
  return champion.runtime.zyrelleAmmo ?? MAX_AMMO;
}

// Spends up to `count` rounds, capped by what's actually loaded, and marks the
// turn as one where she fired — so the passive's idle-reload check knows not
// to top her off. Returns how many rounds actually fired.
export function fireBullets(champion, count, context) {
  const available = getAmmo(champion);
  const fired = Math.min(count, available);

  champion.runtime.zyrelleAmmo = available - fired;

  if (fired > 0) {
    champion.runtime.zyrelleLastFiredTurn = context?.currentTurn;
  }

  return fired;
}
