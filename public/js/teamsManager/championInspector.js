import {
  escapeHtml,
  renderChampionIdentityBadgesMarkup,
  getChampionSpecies,
  toReadableLabel,
} from "./championCardMarkup.js";

const STAT_FIELDS = [
  ["HP", "HP"],
  ["ATK", "Attack"],
  ["DEF", "Defense"],
  ["SPD", "Speed"],
];

function readDescription(entry, champion) {
  return typeof entry.description === "function"
    ? entry.description(champion)
    : entry.description || "";
}

function renderKitEntry(entry, { kind, champion }) {
  const isUlt = entry.isUltimate === true;
  const tag =
    kind === "passive"
      ? `<span class="tm-kit-tag tm-kit-tag-passive">Passive</span>`
      : isUlt
        ? `<span class="tm-kit-tag tm-kit-tag-ult">Ultimate</span>`
        : "";

  let cost = "";
  if (isUlt && Number.isFinite(entry.momentumCost)) {
    cost = `<span class="tm-kit-cost">${entry.momentumCost} Momentum</span>`;
  } else if (kind === "skill" && Number.isFinite(entry.bf) && entry.bf > 0) {
    cost = `<span class="tm-kit-cost">${entry.bf} bf</span>`;
  }

  return `
    <article class="tm-kit ${isUlt ? "is-ult" : ""} ${kind === "passive" ? "is-passive" : ""}">
      <div class="tm-kit-head">
        <span class="tm-kit-name">${escapeHtml(entry.name)}</span>
        ${tag}${cost}
      </div>
      <p class="tm-kit-body">${readDescription(entry, champion)}</p>
    </article>
  `;
}

/** The centre panel: one champion shown at reading size, whole kit visible. */
export function renderChampionInspector(
  champion,
  { inTeam = false, duo = null, partnerNames = "" } = {},
) {
  const stats = STAT_FIELDS.filter(([, field]) =>
    Number.isFinite(champion[field]),
  )
    .map(
      ([label, field]) =>
        `<div class="tm-stat"><span class="tm-stat-label">${label}</span><span class="tm-stat-value">${champion[field]}</span></div>`,
    )
    .join("");

  const species = getChampionSpecies(champion).map(toReadableLabel).join(" · ");
  const skills = Array.isArray(champion.skills) ? champion.skills : [];

  // Descriptions are written against a live champion; outside a match the
  // closest honest stand-in is one that has not acted yet.
  const preview = { ...champion, runtime: { ...(champion.initialRuntime ?? {}) } };

  const actionLabel = duo
    ? inTeam
      ? `Remove ${escapeHtml(duo.name)}`
      : `Add ${escapeHtml(duo.name)}`
    : inTeam
      ? "Remove from team"
      : "Add to team";

  return `
    <div class="tm-inspector-card">
      <div class="tm-inspector-top">
        <div class="tm-inspector-portrait">
          <img src="${escapeHtml(champion.portrait)}" alt="${escapeHtml(champion.name)}">
        </div>
        <div class="tm-inspector-ident">
          <h3>${escapeHtml(champion.name)}</h3>
          <div class="tm-inspector-badges">${renderChampionIdentityBadgesMarkup(champion)}</div>
          ${species ? `<p class="tm-inspector-species">${escapeHtml(species)}</p>` : ""}
          <div class="tm-stat-line">${stats}</div>
          ${
            duo && partnerNames
              ? `<p class="tm-inspector-duo-note">Drafted as one card with ${escapeHtml(partnerNames)} — both enter play together or not at all.</p>`
              : ""
          }
        </div>
      </div>

      <div class="tm-kit-list">
        ${champion.passive ? renderKitEntry(champion.passive, { kind: "passive", champion: preview }) : ""}
        ${skills.map((skill) => renderKitEntry(skill, { kind: "skill", champion: preview })).join("")}
      </div>

      <button type="button"
        class="tm-inspector-action ${inTeam ? "tm-danger-btn" : "tm-primary-btn"}"
        data-act="toggle-team">
        ${actionLabel}
      </button>
    </div>
  `;
}

export function renderInspectorEmpty() {
  return `
    <div class="tm-inspector-empty">
      <i class="bx bx-book-reader"></i>
      <p>Pick a champion from the roster to read their passive and skills.</p>
    </div>
  `;
}
