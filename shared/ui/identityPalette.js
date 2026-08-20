// shared/ui/identityPalette.js
//
// Single source of truth for the visual identity (icon + colors) of every
// elemental affinity and champion class. Consumed by:
//   - the champion identity badges (lineup banner and selection screen), via
//     the CSS custom properties published by `identityPaletteCssVariables()`;
//   - the emblem selection UI, which paints each emblem with the color(s) of
//     the requirement(s) it asks for.

const ELEMENT_IDENTITIES = Object.freeze({
  fire: {
    label: "Fire",
    icon: "🔥",
    background: "rgba(186, 54, 36, 0.95)",
    border: "rgba(255, 182, 160, 0.68)",
  },
  water: {
    label: "Water",
    icon: "🌊",
    background: "rgba(35, 105, 194, 0.92)",
    border: "rgba(150, 205, 255, 0.72)",
  },
  lightning: {
    label: "Lightning",
    icon: "⚡",
    background: "rgba(199, 173, 55, 0.9)",
    border: "rgba(255, 239, 170, 0.68)",
  },
  earth: {
    label: "Earth",
    icon: "🌱",
    background: "rgba(110, 72, 38, 0.94)",
    border: "rgba(205, 165, 120, 0.7)",
  },
  ice: {
    label: "Ice",
    icon: "❄️",
    background: "rgba(86, 178, 206, 0.92)",
    border: "rgba(198, 242, 255, 0.72)",
  },
  steel: {
    label: "Steel",
    icon: "🛡️",
    background: "rgba(112, 118, 128, 0.95)",
    border: "rgba(225, 230, 235, 0.65)",
  },
});

const CLASS_IDENTITIES = Object.freeze({
  brawler: {
    label: "Brawler",
    icon: "🥊",
    background: "rgba(181, 104, 46, 0.94)",
    border: "rgba(255, 208, 160, 0.72)",
  },
  marksman: {
    label: "Marksman",
    icon: "🏹",
    background: "rgba(52, 128, 146, 0.94)",
    border: "rgba(165, 224, 234, 0.72)",
  },
  mage: {
    label: "Mage",
    icon: "✦",
    background: "rgba(118, 73, 168, 0.94)",
    border: "rgba(213, 187, 255, 0.72)",
  },
  // Assassin used to fall back to the generic class background, which read as
  // the same purple as Mage — it now owns a crimson of its own.
  assassin: {
    label: "Assassin",
    icon: "🗡",
    background: "rgba(158, 40, 86, 0.94)",
    border: "rgba(255, 168, 201, 0.72)",
  },
  tank: {
    label: "Tank",
    icon: "🛡",
    background: "rgba(93, 108, 132, 0.94)",
    border: "rgba(198, 214, 233, 0.72)",
  },
  enchanter: {
    label: "Enchanter",
    icon: "✧",
    background: "rgba(46, 148, 128, 0.94)",
    border: "rgba(175, 236, 226, 0.72)",
  },
});

// Species have no color of their own (only elements and classes are painted)
// and there are far too many of them to ever cover with emoji, so only the
// handful with an unambiguous symbol get one — every other species falls back
// to a neutral tile with its name spelled out.
const SPECIES_ICONS = Object.freeze({
  human: "🧍",
  divinity: "✨",
  spirit: "👻",
  hollowed: "🕯️",
});

const NEUTRAL_IDENTITY = Object.freeze({
  label: "Unknown",
  icon: null,
  background: "rgba(122, 128, 140, 0.9)",
  border: "rgba(226, 230, 238, 0.62)",
});

const BASE_STAT_ICON = "📊";

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toIdentityLabel(value) {
  return String(value ?? "")
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getElementIdentity(element) {
  return ELEMENT_IDENTITIES[normalizeKey(element)] ?? null;
}

function getClassIdentity(classKey) {
  return CLASS_IDENTITIES[normalizeKey(classKey)] ?? null;
}

/** @returns {string|null} the species emoji, or null when it has none. */
function getSpeciesIcon(species) {
  return SPECIES_ICONS[normalizeKey(species)] ?? null;
}

/**
 * Resolves the identity of a requirement kind + key pair, always returning a
 * usable visual so callers never have to branch on missing entries.
 *
 * @param {"elementalAffinity"|"classKey"|"species"|"baseStat"} kind
 * @param {string} key
 */
function getRequirementIdentity(kind, key) {
  switch (kind) {
    case "elementalAffinity":
      return getElementIdentity(key) ?? NEUTRAL_IDENTITY;
    case "classKey":
      return getClassIdentity(key) ?? NEUTRAL_IDENTITY;
    case "species":
      return {
        ...NEUTRAL_IDENTITY,
        label: toIdentityLabel(key),
        icon: getSpeciesIcon(key),
      };
    case "baseStat":
      return {
        ...NEUTRAL_IDENTITY,
        label: toIdentityLabel(key),
        icon: BASE_STAT_ICON,
      };
    default:
      return NEUTRAL_IDENTITY;
  }
}

/**
 * Builds the background for an emblem tile out of its requirement colors:
 * one requirement paints a vertical shade of a single color, two (or more)
 * paint a diagonal gradient that splits the tile between them.
 *
 * @param {Array<{background: string}>} identities
 */
function buildIdentityGradient(identities) {
  const colors = identities.map((identity) => identity.background);

  if (!colors.length) return null;
  if (colors.length === 1) {
    return `linear-gradient(180deg, ${colors[0]}, color-mix(in srgb, ${colors[0]} 62%, #000))`;
  }

  const step = 100 / colors.length;
  const stops = colors.flatMap((color, index) => [
    `${color} ${index * step}%`,
    `${color} ${(index + 1) * step}%`,
  ]);

  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

/**
 * CSS custom properties (`--identity-<key>-bg` / `--identity-<key>-border`) so
 * the stylesheet can reuse the exact same palette without duplicating values.
 */
function identityPaletteCssVariables() {
  const variables = {};

  for (const [key, identity] of Object.entries({
    ...ELEMENT_IDENTITIES,
    ...CLASS_IDENTITIES,
  })) {
    variables[`--identity-${key}-bg`] = identity.background;
    variables[`--identity-${key}-border`] = identity.border;
  }

  return variables;
}

function applyIdentityPaletteCssVariables(root) {
  if (!root?.style) return;

  for (const [name, value] of Object.entries(identityPaletteCssVariables())) {
    root.style.setProperty(name, value);
  }
}

export {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
  NEUTRAL_IDENTITY,
  getElementIdentity,
  getClassIdentity,
  getSpeciesIcon,
  getRequirementIdentity,
  toIdentityLabel,
  buildIdentityGradient,
  identityPaletteCssVariables,
  applyIdentityPaletteCssVariables,
};
