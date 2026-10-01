import { EMBLEMS } from "/shared/data/emblems/index.js";
import { championDB } from "/shared/data/championDB.js";
import {
  getRequirementIdentity,
  buildIdentityGradient,
  renderIdentityIconMarkup,
} from "/shared/ui/identityPalette.js";
import { MAX_TEAM_EMBLEMS } from "/shared/data/teams/index.js";
import { countEmblemRequirements } from "/shared/data/emblems/eligibility.js";
import { resolveText } from "/shared/i18n/locale.js";
import { getLocale } from "../i18n/clientLocale.js";
import { escapeHtml } from "./championCardMarkup.js";

// How each requirement kind names itself in the UI.
const DESCRIBE_REQUIREMENT = Object.freeze({
  elementalAffinity: (identity) => `${identity.label} affinity`,
  species: (identity) => `${identity.label} species`,
  classKey: (identity) => `${identity.label} class`,
  baseStat: (identity, threshold) =>
    `${identity.label}${threshold == null ? "" : ` ≥ ${threshold}`}`,
});

/**
 * The emblem's requirement checks against the roster, each with the visual
 * identity (emoji + colour) and the label the UI paints it with.
 */
export function evaluateEmblemRequirements(emblem, rosterKeys = []) {
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const checks = countEmblemRequirements(emblem, roster).map((check) => {
    const { kind } = check.descriptor;
    const identity = getRequirementIdentity(kind, check.target);
    return {
      ...check,
      identity,
      label: DESCRIBE_REQUIREMENT[kind](identity, check.threshold),
    };
  });

  return { allMet: checks.every((check) => check.pass), checks };
}

/** Every requirement check the chosen emblems still fail against the roster. */
export function getUnmetEmblemChecks(emblemKeys = [], rosterKeys = []) {
  return emblemKeys.flatMap((key) => {
    const emblem = EMBLEMS.find((entry) => entry.key === key);
    if (!emblem) return [];
    return evaluateEmblemRequirements(emblem, rosterKeys)
      .checks.filter((check) => !check.pass)
      .map((check) => ({ ...check, emblem }));
  });
}

/** True when adding `champion` would count toward `check`. */
export function championFillsCheck(champion, check) {
  if (!champion) return false;
  return check.descriptor.matches(champion, check.target, check.threshold);
}

export function getEmblemShortCode(emblem) {
  if (!emblem?.name) return "EM";
  const realName = emblem.name.replace(/^Emblem of(?: the)?\s+/i, "").trim();
  if (!realName) return "EM";
  const words = realName.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() || "").join("") || "EM";
}

function renderRequirementMarkerMarkup({ identity, label }) {
  const marker = renderIdentityIconMarkup(identity, {
    className: "emblem-requirement-marker-art",
    alt: identity.icon ?? identity.label ?? label,
  });
  return `<span class="emblem-requirement-marker" title="${escapeHtml(label)}">${marker}</span>`;
}

export function renderRequirementCountsMarkup(checks) {
  if (!checks.length) return "No requirements";
  return checks
    .map(
      (check) =>
        `${renderRequirementMarkerMarkup(check)} ${check.actual}/${check.required}`,
    )
    .join(" · ");
}

function getEmblemRequirementGradient(checks) {
  return buildIdentityGradient(checks.map((check) => check.identity));
}

const STATE_ICON_PATHS = Object.freeze({
  met: "M5 12.5l4.5 4.5L19 7.5",
  unmet: "M7 7l10 10M17 7L7 17",
});

// Off: an empty socket. On: a lit seal — a check once the line-up meets the
// requirements, a cross while it still does not.
function renderEmblemStateMarkup(isSelected, allMet) {
  if (!isSelected && allMet) {
    // Ready: the line-up already qualifies, the emblem only needs switching on.
    const title = "Not selected — your line-up already meets the requirements";
    return `<span class="emblem-option-state" data-state="ready" title="${title}" aria-label="${title}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STATE_ICON_PATHS.met}"/></svg>
  </span>`;
  }
  if (!isSelected) {
    return `<span class="emblem-option-state" data-state="off" title="Not selected"></span>`;
  }
  const state = allMet ? "met" : "unmet";
  const title = allMet ? "Active — requirements met" : "Active — requirements not met yet";
  return `<span class="emblem-option-state" data-state="${state}" title="${title}" aria-label="${title}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STATE_ICON_PATHS[state]}"/></svg>
  </span>`;
}

let emblemTooltip = null;

export function hideEmblemTooltip() {
  if (emblemTooltip) {
    emblemTooltip.remove();
    emblemTooltip = null;
  }
}

/**
 * Emblem descriptions are trusted static data carrying `<b>` markup, so they
 * render as HTML. `requirementStatus` null leaves the requirement counts out.
 */
export function showEmblemTooltip(target, emblem, requirementStatus = { checks: [] }) {
  hideEmblemTooltip();

  const description =
    typeof emblem.description === "function"
      ? emblem.description()
      : emblem.description || "";
  const requirementMarkup = requirementStatus
    ? `
    <div class="emblem-tooltip-meta">
      <span class="emblem-tooltip-meta-label">Requirements</span>
      <strong>${renderRequirementCountsMarkup(requirementStatus.checks ?? [])}</strong>
    </div>`
    : "";

  const tooltip = document.createElement("div");
  tooltip.className = "emblem-tooltip";
  tooltip.innerHTML = `
    <div class="emblem-tooltip-title">${escapeHtml(emblem.name || emblem.key)}</div>
    <div class="emblem-tooltip-copy">${resolveText(description, getLocale())}</div>${requirementMarkup}
  `;
  document.body.appendChild(tooltip);
  emblemTooltip = tooltip;

  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = Math.max(
    12,
    Math.min(
      rect.left + rect.width / 2 - tooltipRect.width / 2,
      window.innerWidth - tooltipRect.width - 12,
    ),
  );
  const top = Math.max(12, rect.top - tooltipRect.height - 12);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Renders the emblem picker into `list`. `selectedKeys` is mutated through the
 * `onToggle` callback, which receives the next selection array.
 */
export function renderEmblemPanel({
  list,
  counter,
  selectedKeys,
  rosterKeys,
  onToggle,
}) {
  if (!list) return;
  list.innerHTML = "";

  EMBLEMS.forEach((emblem) => {
    const isSelected = selectedKeys.includes(emblem.key);
    const requirementStatus = evaluateEmblemRequirements(emblem, rosterKeys);
    // Unmet emblems stay selectable: choosing one narrows the roster grid to
    // the champions that fill it, and saving waits until it is met.
    const isLocked = !isSelected && selectedKeys.length >= MAX_TEAM_EMBLEMS;

    const item = document.createElement("button");
    item.type = "button";
    item.className = `emblem-option ${isSelected ? "selected" : ""} ${requirementStatus.allMet ? "eligible" : "blocked"}`;
    item.disabled = isLocked;
    item.dataset.emblemKey = emblem.key;

    const gradient = getEmblemRequirementGradient(requirementStatus.checks);
    if (gradient) item.style.setProperty("--emblem-requirement-tint", gradient);

    item.innerHTML = `
      <span class="emblem-option-badge">${escapeHtml(getEmblemShortCode(emblem))}</span>
      <span class="emblem-option-copy">
        <strong>${escapeHtml(emblem.name || emblem.key)}</strong>
        <small>Requirements ${renderRequirementCountsMarkup(requirementStatus.checks)}</small>
      </span>
      ${renderEmblemStateMarkup(isSelected, requirementStatus.allMet)}
    `;
    item.setAttribute("aria-pressed", String(isSelected));

    item.addEventListener("click", () => {
      const next = [...selectedKeys];
      const existing = next.indexOf(emblem.key);
      if (existing >= 0) next.splice(existing, 1);
      else if (next.length < MAX_TEAM_EMBLEMS) next.push(emblem.key);
      else return;
      onToggle(next);
    });

    item.addEventListener("mouseenter", () =>
      showEmblemTooltip(item, emblem, requirementStatus),
    );
    item.addEventListener("mouseleave", hideEmblemTooltip);
    item.addEventListener("focus", () =>
      showEmblemTooltip(item, emblem, requirementStatus),
    );
    item.addEventListener("blur", hideEmblemTooltip);

    list.appendChild(item);
  });

  if (counter) counter.textContent = String(selectedKeys.length);
}
