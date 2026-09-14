import {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
} from "/shared/ui/identityPalette.js";
import { getChampionClassKeys } from "/shared/data/championClasses.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const affinityBadgeByKey = Object.freeze(
  Object.fromEntries(
    Object.entries(ELEMENT_IDENTITIES).map(([key, { icon }]) => [key, icon]),
  ),
);

export function toReadableLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeChampionClassKeys(champion) {
  return getChampionClassKeys(champion).filter((key) => CLASS_IDENTITIES[key]);
}

export function getChampionSpecies(champion) {
  if (Array.isArray(champion.species)) {
    return champion.species.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof champion.speciesTag === "string") {
    return champion.speciesTag
      .replace(/^species\s*:\s*/i, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getChampionFrontBadges(champion) {
  const affinityKeys = Array.isArray(champion.elementalAffinities)
    ? champion.elementalAffinities
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    : typeof champion.elementalAffinities === "string"
      ? [champion.elementalAffinities.trim().toLowerCase()].filter(Boolean)
      : [];
  const badges = [];

  normalizeChampionClassKeys(champion).forEach((classKey) => {
    const classInfo = CLASS_IDENTITIES[classKey];
    badges.push({
      type: "class",
      label: `Class: ${classInfo.label}`,
      iconText: classInfo.icon,
      iconUrl: classInfo.iconUrl ?? null,
    });
  });

  affinityKeys.forEach((affinityKey) => {
    badges.push({
      type: "affinity",
      label: `Affinity: ${toReadableLabel(affinityKey)}`,
      iconText: affinityBadgeByKey[affinityKey] ?? "✨",
      iconUrl: ELEMENT_IDENTITIES[affinityKey]?.iconUrl ?? null,
    });
  });

  return badges;
}

export function renderChampionIdentityBadgesMarkup(champion) {
  return getChampionFrontBadges(champion)
    .map(
      ({ type, iconText, iconUrl, label }) => `
        <span class="champion-identity-badge champion-identity-badge-${type}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
          ${
            iconUrl
              ? `<img class="champion-identity-badge-image" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(label)}">`
              : escapeHtml(iconText)
          }
        </span>
      `,
    )
    .join("");
}

export function sortChampionKeysAlphabetically(keys, championDB) {
  return keys.sort((a, b) => {
    const nameA = championDB[a]?.name?.toLowerCase() || "";
    const nameB = championDB[b]?.name?.toLowerCase() || "";
    return nameA.localeCompare(nameB);
  });
}
