// Bridge between the combat animation queue and the arena backdrop.
//
// The backdrop is created in main.js while the animation manager is built
// elsewhere; this tiny registry lets the manager nudge the scenery without
// importing the renderer. With no backdrop attached every call is a no-op.

// Mood presets are plain data so the strengths stay tunable in one place.
export const ARENA_MOODS = {
  ultimate: { pulse: 1, dark: 0.25 },
  death: { pulse: 0.15, dark: 0.7 },
};

let sink = null;

export function attachArenaMood(backdrop) {
  sink = backdrop;
}

export function detachArenaMood(backdrop) {
  if (sink === backdrop) sink = null;
}

export function triggerArenaMood(kind) {
  const mood = ARENA_MOODS[kind];
  if (mood) sink?.react(mood);
}
