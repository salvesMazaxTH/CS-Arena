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
    background: "rgba(40, 140, 185, 0.85)",
    label: "Marked",
  },
);

// Zyrelle's revolver: current rounds loaded (runtime.zyrelleAmmo), 0-6.
registerRuntimeCounterIndicator("zyrelle_ammo", "zyrelleAmmo", {
  type: "image",
  value: "/assets/indicators/zyrelle_ammo_indicator.svg",
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

// Harlan Greeves' Quickdraw (runtime.harlanHalfStepUntilTurn): the enemy's next
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

// Harlan Greeves' ultimate, Wanted Dead or Alive (runtime.harlanWanted): while
// this holds and the target lives, Harlan's CLAIM cashes in bonus points.
registerRuntimeCounterIndicator("harlan_wanted", "harlanWanted", {
  type: "emoji",
  value: "🎯",
  background: "rgba(139, 101, 54, 0.85)",
  label: "Wanted",
});

// Tony Raiturus' The Flash Arrives First (runtime.raiturusThunder): damage
// already dealt whose sound has not reached the target yet.
registerRuntimeCounterIndicator("raiturus_thunder", "raiturusThunder", {
  type: "emoji",
  value: "🔊",
  background: "rgba(214, 163, 32, 0.85)",
  label: "Thunder Incoming",
});

// Jack's Show Your Work (runtime.jackSolved): the best damage figure he has got
// out of this enemy, which his damage against them can no longer fall below.
registerRuntimeCounterIndicator("jack_solved", "jackSolved", {
  type: "emoji",
  value: "🧮",
  background: "rgba(72, 132, 196, 0.85)",
  label: "Solved",
  showStackCount: true,
});

// Layla's Buried Static (runtime.laylaStatic): charges banked from being hit,
// spent on her next damaging ability for bonus damage.
registerRuntimeCounterIndicator("layla_static", "laylaStatic", {
  type: "emoji",
  value: "🔋",
  background: "rgba(96, 122, 210, 0.85)",
  label: "Static",
  showStackCount: true,
});

// Mali Magarc's Older Than Refinement (runtime.maliUnrefined): magical damage
// stripped to raw arcane, paid back to him as Momentum over the next turns.
registerRuntimeCounterIndicator("mali_unrefined", "maliUnrefined", {
  type: "emoji",
  value: "✴️",
  background: "rgba(72, 96, 190, 0.85)",
  label: "Essence",
  showStackCount: true,
});

// Cassian's Blood Tide (runtime.cassianBloodMeter): fills from every hit he
// lands or takes, flipping his form between defense and offense once full.
// Icon: "Transfuse" by Lorc (game-icons.net, CC BY 3.0).
registerRuntimeCounterIndicator("cassian_blood_tide", "cassianBloodMeter", {
  type: "image",
  value: "/assets/indicators/blood_tide_indicator.svg",
  background: "rgba(150, 20, 30, 0.85)",
  label: "Blood Tide",
  showStackCount: true,
  imageSize: 35,
});

// Killer Meow's Nine Lives (runtime.meowLives): what he still has left to spend
// on changing his mind.
registerRuntimeCounterIndicator("meow_lives", "meowLives", {
  type: "emoji",
  value: "🐾",
  background: "rgba(60, 60, 70, 0.85)",
  label: "Lives",
  showStackCount: true,
});

// Calyphera's Facets (runtime.calypheraFacets): the lines of light the long
// fight has cut through her, each one raising the damage she deals.
registerRuntimeCounterIndicator("calyphera_facets", "calypheraFacets", {
  type: "emoji",
  value: "💎",
  background: "rgba(120, 170, 200, 0.85)",
  label: "Facets",
  showStackCount: true,
});

// Weyne's Stillness (runtime.weyneStillness): the shots she chose not to take,
// riding every round she does fire until something makes her lose HP.
// Icon: "Lungs" by Delapouite (game-icons.net, CC BY 3.0).
registerRuntimeCounterIndicator("weyne_stillness", "weyneStillness", {
  type: "image",
  value: "/assets/indicators/weyne_stillness_indicator.svg",
  background: "rgba(40, 80, 115, 0.88)",
  label: "Stillness",
  showStackCount: true,
  imageSize: 32,
});

// Weyne's Steady (runtime.weyneSteady): the turns nobody has drawn her blood,
// each one worth hit chance on her Basic Shot.
// Icon: "Dead eye" by Lorc (game-icons.net, CC BY 3.0).
registerRuntimeCounterIndicator("weyne_steady", "weyneSteady", {
  type: "image",
  value: "/assets/indicators/weyne_steady_indicator.svg",
  background: "rgba(55, 100, 140, 0.88)",
  label: "Steady",
  showStackCount: true,
  imageSize: 32,
});

// Weyne's Cold Zero (runtime.weyneZeroed): the round she has already measured.
// Icon: "Reticule" by Lorc (game-icons.net, CC BY 3.0).
registerRuntimeCounterIndicator("weyne_cold_zero", "weyneZeroed", {
  type: "image",
  value: "/assets/indicators/weyne_cold_zero_indicator.svg",
  background: "rgba(70, 120, 160, 0.88)",
  label: "Cold Zero",
  imageSize: 32,
});

// Victoria's Ember Brand (runtime.victoriaEmberBrandUntilTurn): her next hit
// on the branded enemy pierces part of their Defense.
registerRuntimeCounterIndicator(
  "victoria_ember_brand",
  "victoriaEmberBrandUntilTurn",
  {
    type: "emoji",
    value: "♨️",
    background: "rgba(255, 110, 30, 0.85)",
    label: "Branded",
  },
);

// The heat Victoria's Phoenix Aegis is holding (runtime.victoriaStoredHeat),
// released on every enemy the moment the aegis ends.
registerRuntimeCounterIndicator("victoria_stored_heat", "victoriaStoredHeat", {
  type: "emoji",
  value: "🌋",
  background: "rgba(200, 60, 0, 0.85)",
  label: "Stored Heat",
  showStackCount: true,
});

// Bergrisa's Sediment (runtime.bergrisaSediment): the layers of the world that
// have settled into her, blunting what she takes and restoring HP each turn.
registerRuntimeCounterIndicator("bergrisa_sediment", "bergrisaSediment", {
  type: "emoji",
  value: "🪨",
  background: "rgba(105, 95, 80, 0.88)",
  label: "Sediment",
  showStackCount: true,
});

