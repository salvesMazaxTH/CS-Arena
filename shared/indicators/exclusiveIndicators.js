/**
 * Registry de indicators exclusivos de personagem/habilidade.
 *
 * Status effects genéricos (presentes em múltiplos campeões) ficam em
 * statusEffectIcons dentro de statusIndicator.js.
 *
 * Efeitos exclusivos de um único personagem/habilidade se registram aqui.
 * O statusIndicator.js consulta este registry de forma genérica,
 * sem importar nada específico de nenhum efeito.
 *
 * Para adicionar um novo indicator exclusivo:
 *   registerExclusiveIndicator("nomeDoEfeito", { type, value, background?, color? });
 */

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

// ── Registro de indicators exclusivos ──────────────────────────

// Reyskarone's Blood Tithe: the hookEffect key is "tithe".
// The asset file is still named tributo_indicator.png.
registerExclusiveIndicator("tithe", {
  type: "image",
  value: "/assets/indicators/tributo_indicator.png",
  background: "",
});

// Zyrelle's revolver: current rounds loaded (runtime.zyrelleAmmo), 0-6.
registerRuntimeCounterIndicator("zyrelle_ammo", "zyrelleAmmo", {
  type: "image",
  value: "/assets/indicators/ammo_indicator.png",
  background: "rgba(100, 200, 255, 0.8)",
  label: "Rounds Loaded",
  showStackCount: true,
});
