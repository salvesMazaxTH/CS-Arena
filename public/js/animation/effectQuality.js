// ============================================================
//  Effect Quality
//
//  Watches how long VFX frames actually take and drops particle
//  density once a device proves it can't keep up, instead of guessing
//  from static hardware info that doesn't track GPU fill-rate. A
//  device that's already keeping pace (measured, not assumed) is
//  never touched. Quality can also recover if frames get clean again
//  (e.g. a background hiccup passes), but only up to MAX_TRANSITIONS
//  flips total, so it can't oscillate forever — after that it just
//  settles on whatever it last measured.
// ============================================================

const SLOW_FRAME_MS = 34; // worse than ~30fps
const FRAMES_TO_DOWNGRADE = 6;
const FRAMES_TO_RECOVER = 12; // longer streak required to trust a recovery
const MAX_TRANSITIONS = 4;
const REDUCED_SCALE = 0.45;

let streak = 0;
let reduced = false;
let transitions = 0;

// Called once per VFX frame with its measured delta (seconds).
export function recordEffectFrame(dt) {
  if (transitions >= MAX_TRANSITIONS) return;

  const slow = dt * 1000 > SLOW_FRAME_MS;
  const movesTowardFlip = reduced ? !slow : slow;

  if (!movesTowardFlip) {
    streak = 0;
    return;
  }

  streak++;
  if (streak >= (reduced ? FRAMES_TO_RECOVER : FRAMES_TO_DOWNGRADE)) {
    reduced = !reduced;
    transitions++;
    streak = 0;
  }
}

// Multiplier for particle counts: 1 on devices keeping pace, lower once
// recordEffectFrame has proven the device can't.
export function getParticleScale() {
  return reduced ? REDUCED_SCALE : 1;
}
