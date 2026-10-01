import { championDB } from "/shared/data/championDB.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import { TEAM_SIZE } from "/shared/data/teams/index.js";
import { escapeHtml } from "../teamsManager/championCardMarkup.js";
import { getEmblemShortCode } from "../teamsManager/emblemPanel.js";

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
      return `<span class="team-emblem-chip" title="${escapeHtml(emblem.name)}">${escapeHtml(getEmblemShortCode(emblem))}</span>`;
    })
    .join("");
}

/** The visual summary of a team: name, tagline, ordered portraits, emblem badges. */
export function renderTeamSummary(team, { originTag = true } = {}) {
  const tag =
    originTag && team.origin
      ? `<span class="team-origin-tag team-origin-${team.origin === "prebuilt" ? "prebuilt" : "custom"}">${team.origin === "prebuilt" ? "Prebuilt" : "Custom"}</span>`
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
