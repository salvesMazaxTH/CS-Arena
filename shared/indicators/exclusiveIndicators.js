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

// ── Registro de indicators exclusivos ──────────────────────────

// Reyskarone's Blood Tithe: the hookEffect key is "tithe".
// The asset file is still named tributo_indicator.png.
registerExclusiveIndicator("tithe", {
  type: "image",
  value: "/assets/indicators/tributo_indicator.png",
  background: "",
});
