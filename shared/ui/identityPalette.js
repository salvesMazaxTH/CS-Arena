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

// Each class carries its own framed art (a round icon with its border baked in),
// so `iconUrl` is what gets drawn wherever a class marker appears. `background` /
// `border` are the class colour, sampled from that art.
const CLASS_IDENTITIES = Object.freeze({
  brawler: {
    label: "Brawler",
    iconUrl: "/assets/indicators/brawler_class_icon.png",
    background: "rgba(221, 42, 42, 0.94)",
    border: "rgba(255, 170, 170, 0.72)",
  },
  marksman: {
    label: "Marksman",
    iconUrl: "/assets/indicators/marksman_class_icon.png",
    background: "rgba(139, 71, 227, 0.94)",
    border: "rgba(214, 183, 255, 0.74)",
  },
  mage: {
    label: "Mage",
    iconUrl: "/assets/indicators/mage_class_icon.png",
    background: "rgba(42, 116, 246, 0.95)",
    border: "rgba(176, 208, 255, 0.74)",
  },
  assassin: {
    label: "Assassin",
    iconUrl: "/assets/indicators/assassin_class_icon.png",
    background: "rgba(228, 38, 128, 0.94)",
    border: "rgba(255, 175, 214, 0.74)",
  },
  tank: {
    label: "Tank",
    iconUrl: "/assets/indicators/tank_class_icon.png",
    background: "rgba(183, 132, 42, 0.95)",
    border: "rgba(240, 210, 150, 0.72)",
  },
  enchanter: {
    label: "Enchanter",
    iconUrl: "/assets/indicators/enchanter_class_icon.png",
    background: "rgba(74, 173, 40, 0.94)",
    border: "rgba(180, 240, 160, 0.72)",
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
 * Inline markup for an identity's marker: its own framed art when it has one,
 * the emoji otherwise. `alt` is the image alt text and the emoji-less fallback.
 * Callers pass their own already-safe label strings.
 */
function renderIdentityIconMarkup(identity, { className = "", alt = "" } = {}) {
  const cls = className ? ` class="${className}"` : "";
  if (identity?.iconUrl) {
    return `<img${cls} src="${identity.iconUrl}" alt="${alt}">`;
  }
  return `<span${cls}>${identity?.icon ?? alt}</span>`;
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
  renderIdentityIconMarkup,
  toIdentityLabel,
  buildIdentityGradient,
  identityPaletteCssVariables,
  applyIdentityPaletteCssVariables,
};
