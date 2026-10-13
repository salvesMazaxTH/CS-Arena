// Arena backdrop scene definitions.
//
// A scene is a plain object the backdrop renderer reads; it never owns code.
// Today every scene is procedural (`kind: "procedural"`, a palette plus the
// numeric knobs the shader exposes). An illustrated scene can be added later as
// `{ id, kind: "layered", layers: [{ src, depth, ... }] }` without touching the
// renderer's public API. Palette variants are picked from the match seed, never
// from a team's element, so the scenery doesn't imply elemental synergy.

const HALL_UNIFORMS = {
  fogDensity: 0.55,
  fogDrift: 0.018,
  shaftStrength: 0.34,
  shaftCount: 3,
  runeRadius: 0.5,
  runeRotation: 0.02,
  runeGlow: 0.8,
  emberDensity: 0.55,
  emberRise: 0.05,
  vignette: 0.62,
  floorHorizon: 0.62,
  floorGrid: 0.35,
};

// Colours are linear-ish 0..1 RGB triples.
export const ARENA_SCENES = [
  {
    id: "ashen_hall",
    kind: "procedural",
    palette: {
      deep: [0.02, 0.025, 0.035],
      mid: [0.1, 0.13, 0.17],
      accent: [0.2, 0.55, 0.5],
      glow: [0.95, 0.75, 0.4],
      ember: [1.0, 0.62, 0.25],
    },
    uniforms: HALL_UNIFORMS,
  },
  {
    id: "frost_vault",
    kind: "procedural",
    palette: {
      deep: [0.015, 0.025, 0.045],
      mid: [0.07, 0.12, 0.2],
      accent: [0.25, 0.55, 0.9],
      glow: [0.7, 0.85, 1.0],
      ember: [0.7, 0.88, 1.0],
    },
    uniforms: { ...HALL_UNIFORMS, emberDensity: 0.4, fogDensity: 0.7 },
  },
  {
    id: "crimson_pit",
    kind: "procedural",
    palette: {
      deep: [0.035, 0.015, 0.02],
      mid: [0.17, 0.07, 0.08],
      accent: [0.75, 0.2, 0.25],
      glow: [1.0, 0.5, 0.3],
      ember: [1.0, 0.45, 0.2],
    },
    uniforms: { ...HALL_UNIFORMS, emberDensity: 0.75, shaftStrength: 0.26 },
  },
];

/** Deterministic pick so both clients in a match see the same scenery. */
export function pickArenaScene(seed) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return ARENA_SCENES[hash % ARENA_SCENES.length];
}
