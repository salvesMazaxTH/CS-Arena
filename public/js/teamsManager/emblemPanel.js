import { EMBLEMS } from "/shared/data/emblems/index.js";
import { championDB } from "/shared/data/championDB.js";
import {
  getRequirementIdentity,
  buildIdentityGradient,
  renderIdentityIconMarkup,
} from "/shared/ui/identityPalette.js";
import { MAX_TEAM_EMBLEMS } from "/shared/data/teams/index.js";
import {
  readClassRequirements,
  countClassRequirementSlots,
} from "/shared/data/emblems/eligibility.js";
import { resolveText } from "/shared/i18n/locale.js";
import { getLocale } from "../i18n/clientLocale.js";
import {
  escapeHtml,
  normalizeChampionClassKeys,
  getChampionSpecies,
} from "./championCardMarkup.js";

function getChampionAffinityKeys(champion) {
  const affinities = Array.isArray(champion.elementalAffinities)
    ? champion.elementalAffinities
    : typeof champion.elementalAffinities === "string"
      ? [champion.elementalAffinities]
      : [];
  return affinities.map((affinity) => String(affinity).trim().toLowerCase());
}

// One entry per supported requirement kind: how to read its target value out of
// the emblem data and how to count the roster champions that satisfy it.
const EMBLEM_REQUIREMENT_KINDS = Object.freeze([
  {
    kind: "elementalAffinity",
    readTarget: (requirement) =>
      requirement.value ?? requirement.element ?? requirement.key,
    countMatches: (roster, target) =>
      roster.filter((champion) =>
        getChampionAffinityKeys(champion).includes(target),
      ).length,
    describe: (identity) => `${identity.label} affinity`,
  },
  {
    kind: "species",
    readTarget: (requirement) =>
      requirement.value ?? requirement.species ?? requirement.key,
    countMatches: (roster, target) =>
      roster.filter((champion) =>
        getChampionSpecies(champion)
          .map((entry) => entry.toLowerCase())
          .includes(target),
      ).length,
    describe: (identity) => `${identity.label} species`,
  },
  {
    kind: "classKey",
    readTarget: (requirement) =>
      requirement.value ?? requirement.class ?? requirement.key,
    countMatches: (roster, target) =>
      roster.filter((champion) =>
        normalizeChampionClassKeys(champion).includes(target),
      ).length,
    describe: (identity) => `${identity.label} class`,
  },
  {
    kind: "baseStat",
    readTarget: (requirement) =>
      requirement.stat ?? requirement.key ?? requirement.name,
    readThreshold: (requirement) =>
      requirement.min ?? requirement.value ?? requirement.threshold,
    countMatches: (roster, target, threshold) =>
      roster.filter((champion) => {
        const value = Number(champion[target]);
        if (!Number.isFinite(value)) return false;
        return threshold == null || value >= Number(threshold);
      }).length,
    describe: (identity, threshold) =>
      `${identity.label}${threshold == null ? "" : ` ≥ ${threshold}`}`,
  },
]);

function getEmblemRequirementTokens(requirements) {
  if (!requirements || typeof requirements !== "object") return [];

  return EMBLEM_REQUIREMENT_KINDS.flatMap((descriptor) => {
    const requirement = requirements[descriptor.kind];
    if (!requirement) return [];

    // classKey is a list of { key, count }: one token per class.
    const entries = Array.isArray(requirement) ? requirement : [requirement];

    return entries.map((entry) => {
      const rawTarget = String(descriptor.readTarget(entry) ?? "").trim();
      const target =
        descriptor.kind === "baseStat" ? rawTarget : rawTarget.toLowerCase();
      const threshold = descriptor.readThreshold?.(entry) ?? null;
      const identity = getRequirementIdentity(descriptor.kind, target);

      return {
        descriptor,
        target,
        threshold,
        identity,
        required: Number(entry.count || 0),
        label: descriptor.describe(identity, threshold),
      };
    });
  });
}

export function evaluateEmblemRequirements(emblem, rosterKeys = []) {
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  // A champion fills one class slot only, so class counts come from matching.
  const classCounts = countClassRequirementSlots(
    readClassRequirements(emblem?.requirements),
    roster,
  );
  let classIndex = 0;

  const checks = getEmblemRequirementTokens(emblem?.requirements).map((token) => {
    const actual =
      token.descriptor.kind === "classKey"
        ? classCounts[classIndex++]
        : token.descriptor.countMatches(roster, token.target, token.threshold);
    return { ...token, actual, pass: actual >= token.required };
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
  return check.descriptor.countMatches([champion], check.target, check.threshold) > 0;
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

function renderRequirementCountsMarkup(checks) {
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

function hideEmblemTooltip() {
  if (emblemTooltip) {
    emblemTooltip.remove();
    emblemTooltip = null;
  }
}

function showEmblemTooltip(target, emblem, requirementStatus = { checks: [] }) {
  hideEmblemTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "emblem-tooltip";
  tooltip.innerHTML = `
    <div class="emblem-tooltip-title">${escapeHtml(emblem.name || emblem.key)}</div>
    <div class="emblem-tooltip-copy">${escapeHtml(resolveText(typeof emblem.description === "function" ? emblem.description() : emblem.description || "", getLocale()))}</div>
    <div class="emblem-tooltip-meta">
      <span class="emblem-tooltip-meta-label">Requirements</span>
      <strong>${renderRequirementCountsMarkup(requirementStatus.checks ?? [])}</strong>
    </div>
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
