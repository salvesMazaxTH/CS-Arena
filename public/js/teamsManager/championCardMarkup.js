import {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
} from "/shared/ui/identityPalette.js";

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

export function normalizeChampionClassKey(champion) {
  if (typeof champion.classKey === "string") {
    const normalized = champion.classKey.trim().toLowerCase();
    if (CLASS_IDENTITIES[normalized]) return normalized;
  }

  if (typeof champion.classTag === "string") {
    const normalized = champion.classTag
      .replace(/^class\s*:\s*/i, "")
      .trim()
      .toLowerCase();
    if (CLASS_IDENTITIES[normalized]) return normalized;
  }

  return null;
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
  const classKey = normalizeChampionClassKey(champion);
  const classInfo = classKey ? CLASS_IDENTITIES[classKey] : null;

  const badges = [];

  if (classInfo || champion.classIcon || champion.classIconUrl) {
    badges.push({
      type: "class",
      label: classInfo ? `Class: ${classInfo.label}` : "Class",
      iconText: champion.classIcon || classInfo?.icon || "?",
      iconUrl: champion.classIconUrl || null,
    });
  }

  affinityKeys.forEach((affinityKey) => {
    badges.push({
      type: "affinity",
      label: `Affinity: ${toReadableLabel(affinityKey)}`,
      iconText: affinityBadgeByKey[affinityKey] ?? "✨",
      iconUrl: null,
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

export function renderChampionCardContent(champion) {
  const badges = renderChampionIdentityBadgesMarkup(champion);

  const speciesList = getChampionSpecies(champion);
  const speciesMarkup = speciesList.length
    ? speciesList
        .map(
          (species) =>
            `<span class="champion-species-chip">${escapeHtml(toReadableLabel(species))}</span>`,
        )
        .join("")
    : '<span class="champion-species-empty">No species set</span>';

  return `
    <div class="champion-card-inner">
      <div class="champion-card-face champion-card-front">
        <button type="button" class="champion-card-flip-btn" aria-label="Show species" title="Show species">i</button>
        <img class="champion-card-portrait" src="${champion.portrait}" alt="${champion.name}">
        <h3>${champion.name}</h3>
        <div class="champion-identity-row">
          ${badges}
        </div>
      </div>
      <div class="champion-card-face champion-card-back">
        <button type="button" class="champion-card-flip-btn champion-card-flip-btn-back" aria-label="Show front" title="Show front">↺</button>
        <div class="champion-card-back-title">Species</div>
        <div class="champion-species-list">
          ${speciesMarkup}
        </div>
      </div>
    </div>
  `;
}

export function sortChampionKeysAlphabetically(keys, championDB) {
  return keys.sort((a, b) => {
    const nameA = championDB[a]?.name?.toLowerCase() || "";
    const nameB = championDB[b]?.name?.toLowerCase() || "";
    return nameA.localeCompare(nameB);
  });
}
