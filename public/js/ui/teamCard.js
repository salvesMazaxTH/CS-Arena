import { championDB } from "/shared/data/championDB.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import { TEAM_SIZE } from "/shared/data/teams/index.js";
import { escapeHtml } from "../teamsManager/championCardMarkup.js";
import {
  buildIdentityGradient,
  renderIdentityIconMarkup,
} from "/shared/ui/identityPalette.js";
import { evaluateEmblemRequirements, getEmblemShortCode } from "../teamsManager/emblemPanel.js";

function portraitStrip(champions) {
  const cells = Array.from({ length: TEAM_SIZE }, (_, index) => {
    const champion = championDB[champions?.[index]];
    if (!champion) return `<span class="team-portrait team-portrait-empty"></span>`;
    return `<img class="team-portrait" src="${escapeHtml(champion.portrait)}" alt="${escapeHtml(champion.name)}" title="${escapeHtml(champion.name)}">`;
  });
  return `<div class="team-portrait-strip">${cells.join("")}</div>`;
}

function emblemChips(emblems) {
  if (!emblems?.length) {
    return `<span class="team-emblem-chip team-emblem-chip-none">No Emblems</span>`;
  }
  return emblems
    .map((key) => {
      const emblem = EMBLEMS.find((entry) => entry.key === key) || { name: key };
      const identities = requirementIdentities(emblem);
      // Same requirement palette as the picker tiles, with each requirement's
      // symbol watermarked behind the short code.
      const tint = buildIdentityGradient(identities);
      const style = tint ? ` style="--emblem-requirement-tint: ${escapeHtml(tint)}"` : "";
      const marks = identities
        .map((identity) =>
          renderIdentityIconMarkup(identity, { className: "team-emblem-chip-mark" }),
        )
        .join("");
      return `
        <span class="team-emblem-chip${identities.length > 1 ? " is-mixed" : ""}" title="${escapeHtml(emblem.name)}"${style}>
          <span class="team-emblem-chip-marks" aria-hidden="true">${marks}</span>
          <span class="team-emblem-chip-code">${escapeHtml(getEmblemShortCode(emblem))}</span>
        </span>`;
    })
    .join("");
}

function requirementIdentities(emblem) {
  if (!emblem.key) return [];
  const seen = new Set();
  return evaluateEmblemRequirements(emblem)
    .checks.map((check) => check.identity)
    .filter((identity) => {
      const id = identity?.iconUrl ?? identity?.icon ?? identity?.label;
      if (!identity || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

/** The visual summary of a team: name, tagline, ordered portraits, emblem badges. */
export function renderTeamSummary(team, { originTag = true } = {}) {
  const origin =
    team.origin === "prebuilt" ? "prebuilt" : team.editMode ? "test" : "custom";
  const originLabel = { prebuilt: "Prebuilt", test: "Test", custom: "Custom" }[origin];
  const tag =
    originTag && team.origin
      ? `<span class="team-origin-tag team-origin-${origin}" title="${origin === "test" ? "Saved in edit mode; hidden outside it." : ""}">${originLabel}</span>`
      : "";

  return `
    <div class="team-summary-head">
      <div class="team-summary-title">
        <h3>${escapeHtml(team.name)}</h3>
        <p class="team-summary-tagline">${escapeHtml(team.tagline || "")}</p>
      </div>
      ${tag}
    </div>
    ${portraitStrip(team.champions)}
    <div class="team-summary-emblems">${emblemChips(team.emblems)}</div>
  `;
}
