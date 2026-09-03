import { EMBLEMS } from "/shared/data/emblems/index.js";
import { championDB } from "/shared/data/championDB.js";
import {
  getRequirementIdentity,
  buildIdentityGradient,
} from "/shared/ui/identityPalette.js";
import { MAX_TEAM_EMBLEMS } from "/shared/data/teams/index.js";
import {
  escapeHtml,
  normalizeChampionClassKey,
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
      roster.filter((champion) => normalizeChampionClassKey(champion) === target)
        .length,
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

    const rawTarget = String(descriptor.readTarget(requirement) ?? "").trim();
    const target =
      descriptor.kind === "baseStat" ? rawTarget : rawTarget.toLowerCase();
    const threshold = descriptor.readThreshold?.(requirement) ?? null;
    const identity = getRequirementIdentity(descriptor.kind, target);

    return [
      {
        descriptor,
        target,
        threshold,
        identity,
        required: Number(requirement.count || 0),
        label: descriptor.describe(identity, threshold),
      },
    ];
  });
}

export function evaluateEmblemRequirements(emblem, rosterKeys = []) {
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const checks = getEmblemRequirementTokens(emblem?.requirements).map((token) => {
    const actual = token.descriptor.countMatches(
      roster,
      token.target,
      token.threshold,
    );
    return { ...token, actual, pass: actual >= token.required };
  });

  return { allMet: checks.every((check) => check.pass), checks };
}

export function getEmblemShortCode(emblem) {
  if (!emblem?.name) return "EM";
  const realName = emblem.name.replace(/^Emblem of(?: the)?\s+/i, "").trim();
  if (!realName) return "EM";
  const words = realName.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() || "").join("") || "EM";
}

function renderRequirementMarkerMarkup({ identity, label }) {
  const marker = identity.icon ?? identity.label ?? label;
  return `<span class="emblem-requirement-marker" title="${escapeHtml(label)}">${escapeHtml(marker)}</span>`;
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
    <div class="emblem-tooltip-copy">${escapeHtml(typeof emblem.description === "function" ? emblem.description() : emblem.description || "")}</div>
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
    const isLocked = !isSelected && selectedKeys.length >= MAX_TEAM_EMBLEMS;
    const isBlocked = !requirementStatus.allMet && !isSelected;

    const item = document.createElement("button");
    item.type = "button";
    item.className = `emblem-option ${isSelected ? "selected" : ""} ${requirementStatus.allMet ? "eligible" : "blocked"}`;
    item.disabled = isLocked || isBlocked;
    item.dataset.emblemKey = emblem.key;

    const gradient = getEmblemRequirementGradient(requirementStatus.checks);
    if (gradient) item.style.setProperty("--emblem-requirement-tint", gradient);

    item.innerHTML = `
      <span class="emblem-option-badge">${escapeHtml(getEmblemShortCode(emblem))}</span>
      <span class="emblem-option-copy">
        <strong>${escapeHtml(emblem.name || emblem.key)}</strong>
        <small>Requirements ${renderRequirementCountsMarkup(requirementStatus.checks)}</small>
      </span>
      <span class="emblem-option-state">${isSelected ? "ON" : requirementStatus.allMet ? "OK" : "REQ"}</span>
    `;

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
