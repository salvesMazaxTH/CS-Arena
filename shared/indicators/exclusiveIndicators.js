// Indicators for effects exclusive to one champion or skill. Generic status
// effects shared by several champions live in statusEffectIcons instead.

const registry = new Map();

export function registerExclusiveIndicator(key, config) {
  registry.set(key.toLowerCase(), config);
}

export function getExclusiveIndicator(key) {
  return registry.get(key.toLowerCase()) ?? null;
}

// Indicators backed by a plain champion.runtime counter instead of a
// statusEffect or hookEffect — e.g. Zyrelle's revolver ammo. statusIndicator.js
// treats the indicator as active whenever champion.runtime[runtimeKey] is
// defined, and reads the badge count straight from that field.
const runtimeCounterEntries = [];

export function registerRuntimeCounterIndicator(statusKey, runtimeKey, config) {
  registerExclusiveIndicator(statusKey, config);
  runtimeCounterEntries.push({ statusKey: statusKey.toLowerCase(), runtimeKey });
}

export function getRuntimeCounterIndicatorEntries() {
  return runtimeCounterEntries;
}

// ── Registered exclusive indicators ─────────────────────────────

// Reyskarone's Blood Tithe: the hookEffect key is "tithe".
// The asset file is still named tributo_indicator.png.
registerExclusiveIndicator("tithe", {
  type: "image",
  value: "/assets/indicators/tributo_indicator.png",
  background: "",
});

// Aren Marevoth's Tide: stacks live on the marked enemy, so this is the only
// place the player can read how many are on it.
registerExclusiveIndicator("marevoth_tide", {
  type: "emoji",
  value: "🌊",
  background: "rgba(30, 110, 180, 0.8)",
  label: "Tide",
  showStackCount: true,
});

// Zyrelle's revolver: current rounds loaded (runtime.zyrelleAmmo), 0-6.
registerRuntimeCounterIndicator("zyrelle_ammo", "zyrelleAmmo", {
  type: "image",
  value: "/assets/indicators/ammo_indicator.png",
  background: "rgba(100, 200, 255, 0.8)",
  label: "Ammo",
  showStackCount: true,
});
