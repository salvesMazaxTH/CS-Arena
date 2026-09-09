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
registerExclusiveIndicator("tithe", {
  type: "image",
  value: "/assets/indicators/tribute_indicator.png",
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

// Oryn's Sentence of the Sky-Courts: the hookEffect key on each Indicted enemy.
registerExclusiveIndicator("sky_courts_indicted", {
  type: "emoji",
  value: "⚖️",
  background: "rgba(120, 130, 210, 0.85)",
  label: "Indicted",
});

// Seymour's Bleaching Ray: the hookEffect key on each Bleached enemy, whose
// healing is cut while it holds.
registerExclusiveIndicator("bleached", {
  type: "emoji",
  value: "🩶",
  background: "rgba(180, 172, 150, 0.85)",
  label: "Bleached",
});

// Kyle Hayato's Shadowstorm (runtime.shadowstormMarkUntilTurn): an enemy who
// CLAIMed, whose points his ultimate can usurp while the mark holds.
registerRuntimeCounterIndicator(
  "shadowstorm_mark",
  "shadowstormMarkUntilTurn",
  {
    type: "emoji",
    value: "🌩️",
    background: "rgba(96, 78, 190, 0.85)",
    label: "Marked",
  },
);

// Zyrelle's revolver: current rounds loaded (runtime.zyrelleAmmo), 0-6.
registerRuntimeCounterIndicator("zyrelle_ammo", "zyrelleAmmo", {
  type: "image",
  value: "/assets/indicators/ammo_indicator.png",
  background: "rgba(100, 200, 255, 0.8)",
  label: "Ammo",
  showStackCount: true,
});

// Lorena's mark (runtime.lorenaMarkUntilTurn): a one-shot guaranteed crit on
// her next hit against the target.
registerRuntimeCounterIndicator("lorena_mark", "lorenaMarkUntilTurn", {
  type: "emoji",
  value: "💋",
  background: "rgba(219, 39, 91, 0.85)",
  label: "Marked",
});

// Harlan Graves' Quickdraw (runtime.harlanHalfStepUntilTurn): the enemy's next
// hit on Harlan lands for half, having just been outdrawn.
registerRuntimeCounterIndicator(
  "harlan_half_step",
  "harlanHalfStepUntilTurn",
  {
    type: "emoji",
    value: "🥴",
    background: "rgba(170, 120, 40, 0.85)",
    label: "Off-Balance",
  },
);

// Harlan Graves' ultimate, Wanted Dead or Alive (runtime.harlanWanted): while
// this holds and the target lives, Harlan's CLAIM cashes in bonus points.
registerRuntimeCounterIndicator("harlan_wanted", "harlanWanted", {
  type: "emoji",
  value: "🎯",
  background: "rgba(139, 101, 54, 0.85)",
  label: "Wanted",
});
