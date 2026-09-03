import { elementEmoji } from "../../../shared/ui/elementEmoji.js";
import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
  CLAIM_MAX_POINTS,
} from "../../../shared/engine/combat/claim.js";
import { GAME_GLOSSARY } from "../gameGlossary.js";

/**
 * Hover/touch overlays: skill tooltips (with glossary), the champion portrait
 * overlay and the quick-stats popover. Owns its own DOM element references.
 * Depends on the live turn and the local player's team, injected as getters.
 */
export function createOverlays({ getCurrentTurn, getPlayerTeam }) {
  let skillOverlay = null;
  let portraitOverlay = null;
  let quickStatsOverlay = null;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const toParagraphs = (text) => String(text ?? "").replace(/\n/g, "<br>");

  // --- Glossary ---

  function extractGlossaryKeys(text) {
    const keys = new Set();

    for (const [key, data] of Object.entries(GAME_GLOSSARY)) {
      const terms = [key, ...(data.aliases || [])];
      for (const term of terms) {
        if (new RegExp(`\\b${term}\\w*`, "i").test(text)) {
          keys.add(key);
          break;
        }
      }
    }

    return [...keys];
  }

  function renderGlossaryStatusEffects(text) {
    if (!text) return text;

    let result = text;
    for (const [key, data] of Object.entries(GAME_GLOSSARY)) {
      const terms = [key, ...(data.aliases || [])];
      for (const term of terms) {
        const regex = new RegExp(`\\b${term}\\w*`, "gi");
        result = result.replace(
          regex,
          `<span class="glossary-statusEffect" data-key="${key}">$&</span>`,
        );
      }
    }

    return result;
  }

  function renderGlossaryPanel(keys) {
    const container = document.createElement("div");
    container.className = "skill-glossary-panel";
    // Non-interactive, so it never steals hover and flickers (see showSkillOverlay).
    container.style.pointerEvents = "none";

    keys.forEach((key) => {
      const entry = GAME_GLOSSARY[key];
      if (!entry) return;

      const item = document.createElement("div");
      item.className = "glossary-item";
      item.innerHTML = `
      <span class="glossary-title">${entry.title}:</span>
      <span class="glossary-desc">${entry.description}</span>
    `;
      container.appendChild(item);
    });

    return container;
  }

  function getClaimPointsPreview(champion) {
    if (!champion) return 0;

    const momentum = Math.max(0, Number(champion?.momentum) || 0);
    if (momentum < CLAIM_MIN_MOMENTUM) return 0;

    const momentumPoints =
      momentum >= 75 ? 3 : momentum >= 50 ? 2 : momentum >= 25 ? 1 : 0;
    const currentTurn = getCurrentTurn();
    const fieldEntryTurn = Number.isFinite(champion?.runtime?.fieldEntryTurn)
      ? Number(champion.runtime.fieldEntryTurn)
      : currentTurn;
    const turnsInField = Math.max(0, currentTurn - fieldEntryTurn);

    return Math.min(CLAIM_MAX_POINTS, momentumPoints + turnsInField);
  }

  function getDamageModeLabel(mode) {
    switch (mode) {
      case "standard":
        return "Standard";
      case "piercing":
        return "Piercing";
      case "absolute":
        return "Absolute";
    }
  }

  // --- Skill overlay ---

  function showSkillOverlay(button, skill, champion) {
    removeSkillOverlay();
    if (!button || !skill) return;

    const overlay = document.createElement("div");
    overlay.className = "skill-hover-overlay";
    // Never let the tooltip capture the pointer: if it appears under the cursor it
    // would fire mouseleave on the button, removing and re-adding the overlay in a
    // rapid flicker loop.
    overlay.style.pointerEvents = "none";

    const rawDesc =
      typeof skill.description === "function"
        ? skill.description(champion)
        : skill.description || "";

    const parsedDesc = renderGlossaryStatusEffects(rawDesc);
    const glossaryKeys = extractGlossaryKeys(rawDesc);

    const isClaim = skill?.key === CLAIM_ACTION_KEY;
    const claimPoints = isClaim ? getClaimPointsPreview(champion) : null;

    // Route through getSkillCost so a ramping ultimate shows its live per-use cost, not the base.
    const skillCost = champion.getSkillCost(skill);
    const momentumCost = skillCost > 0 ? skillCost : null;

    overlay.innerHTML = `

  <div class="skill-overlay-title">
    ${escapeHtml(skill.name || "Skill")}
  </div>

  ${
    isClaim
      ? `
        <div class="skill-overlay-claim-value">
          <span class="meta-label">Claim Value:</span>
          <span class="meta-value">${claimPoints} points</span>
        </div>
      `
      : `
        <div class="skill-overlay-meta-primary">

          ${
            momentumCost
              ? `
            <div class="skill-meta-item">
              <span class="meta-label">Cost:</span>
              <span class="meta-value">
                ${momentumCost} Momentum
              </span>
            </div>
          `
              : ""
          }

          ${
            skill.damageMode != null
              ? `
            <div class="skill-meta-item">
              <span class="meta-label">Damage Type:</span>
              <span class="meta-value">
                ${getDamageModeLabel(skill.damageMode)}
              </span>
            </div>
          `
              : ""
          }

          ${
            skill.bf
              ? `
            <div class="skill-meta-item">
              <span class="meta-label">BF:</span>
              <span class="meta-value">${skill.bf}%</span>
            </div>
          `
              : ""
          }

        </div>

        ${
          skill.element
            ? `
          <div class="skill-overlay-element-row">
            <span class="meta-label">Element:</span>
            <span class="meta-value">
              ${elementEmoji[skill.element] || skill.element}
            </span>
          </div>
        `
            : ""
        }

        <div class="skill-overlay-contact-row">
          <span class="meta-label">Contact:</span>
          <span class="meta-value">${skill.contact ? "✅" : "❌"}</span>
        </div>

        <div class="skill-overlay-content-priority-row">
          <span class="meta-label">Priority:</span>
          <span class="meta-value">
            ${
              skill.priority != null
                ? skill.priority > 0
                  ? `+${skill.priority}`
                  : skill.priority
                : "-"
            }
          </span>
        </div>
      `
  }

  ${
    !isClaim
      ? `
        <div class="skill-overlay-desc">
          ${toParagraphs(parsedDesc)}
        </div>
      `
      : ""
  }

`;

    document.body.appendChild(overlay);
    skillOverlay = overlay;

    let glossaryPanel = null;
    if (glossaryKeys.length) {
      glossaryPanel = renderGlossaryPanel(glossaryKeys);
      document.body.appendChild(glossaryPanel);
    }

    const buttonRect = button.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    let top = buttonRect.bottom + 8;
    let left = buttonRect.left + buttonRect.width / 2 - overlayRect.width / 2;

    if (top + overlayRect.height > window.innerHeight) {
      top = buttonRect.top - overlayRect.height - 8;
    }

    left = Math.max(
      8,
      Math.min(left, window.innerWidth - overlayRect.width - 8),
    );

    overlay.style.position = "fixed";
    overlay.style.top = `${Math.max(8, top)}px`;
    overlay.style.left = `${left}px`;
    overlay.style.zIndex = 15000;

    if (glossaryPanel) {
      const overlayBox = overlay.getBoundingClientRect();
      glossaryPanel.style.position = "fixed";
      glossaryPanel.style.top = `${overlayBox.bottom + 6}px`;
      glossaryPanel.style.left = `${overlayBox.left}px`;
      glossaryPanel.style.zIndex = 15000;
    }

    requestAnimationFrame(() => overlay.classList.add("active"));
  }

  function removeSkillOverlay() {
    if (skillOverlay) {
      skillOverlay.classList.remove("active");
      const toRemove = skillOverlay;
      skillOverlay = null;
      setTimeout(() => toRemove.remove(), 150);
    }

    document
      .querySelectorAll(".skill-glossary-panel")
      .forEach((el) => el.remove());
  }

  // --- Champion portrait overlay ---

  function openChampionOverlay(champion) {
    if (!champion) return;
    if (portraitOverlay) closeChampionOverlay();

    portraitOverlay = createChampionOverlay(champion);
    document.body.appendChild(portraitOverlay);
    requestAnimationFrame(() => portraitOverlay.classList.add("active"));
  }

  function createChampionOverlay(champion) {
    const overlay = document.createElement("div");
    overlay.classList.add("portrait-overlay");

    overlay.innerHTML = `
    <div class="portrait-overlay-content" role="dialog" aria-modal="true">
      <img class="portrait-overlay-img"
          src="${escapeHtml(champion.portrait)}"
          alt="${escapeHtml(champion.name)}">

      <h3 class="portrait-overlay-name">
        ${escapeHtml(champion.name)}
      </h3>
    </div>
  `;

    // --- Passive ---
    const passive = champion?.passive;
    const passiveName = passive?.name ? `PASSIVE — ${passive.name}` : "PASSIVE";

    const rawPassiveDesc =
      typeof passive?.description === "function"
        ? passive.description(champion)
        : typeof passive?.description === "string"
          ? passive.description
          : "";

    const parsedPassiveDesc = renderGlossaryStatusEffects(rawPassiveDesc);
    const passiveGlossaryKeys = extractGlossaryKeys(rawPassiveDesc);

    let passiveItemHtml = "";
    if (parsedPassiveDesc) {
      passiveItemHtml = `
    <div class="portrait-overlay-passive">
      <h4 class="portrait-overlay-passive-name">
        ${escapeHtml(passiveName)}
      </h4>
      <p class="portrait-overlay-passive-desc">
        ${toParagraphs(parsedPassiveDesc)}
      </p>
    </div>
  `;
    }

    const details = document.createElement("div");
    details.classList.add("portrait-overlay-details");
    details.innerHTML = `
    <div class="portrait-overlay-details-content">
      <h3 class="portrait-overlay-details-title">Passive</h3>
      <div class="portrait-overlay-passive-list">
        ${passiveItemHtml}
      </div>
    </div>
  `;

    overlay.appendChild(details);

    // Passive glossary panel.
    if (passiveGlossaryKeys.length) {
      const glossaryPanel = renderGlossaryPanel(passiveGlossaryKeys);
      document.body.appendChild(glossaryPanel);

      requestAnimationFrame(() => {
        const rect = overlay.getBoundingClientRect();
        glossaryPanel.style.position = "fixed";
        glossaryPanel.style.top = `${rect.bottom + 6}px`;
        glossaryPanel.style.left = `${rect.left}px`;
        glossaryPanel.style.zIndex = 15000;
      });
    }

    // Enemy champion skills (fake action bar)
    if (
      getPlayerTeam() !== null &&
      champion.team !== getPlayerTeam() &&
      Array.isArray(champion.skills) &&
      champion.skills.length
    ) {
      const skillsSection = document.createElement("div");
      skillsSection.classList.add("portrait-overlay-enemy-skills");

      const skillsTitle = document.createElement("h3");
      skillsTitle.classList.add("portrait-overlay-details-title");
      skillsTitle.textContent = "Skills";
      skillsSection.appendChild(skillsTitle);

      const skillsBar = document.createElement("div");
      skillsBar.classList.add("portrait-overlay-enemy-skills-bar");

      champion.skills.forEach((skill) => {
        const isUlt = skill.isUltimate === true;
        const label = skill.name;

        const btn = document.createElement("button");
        btn.className =
          "portrait-overlay-enemy-skill-btn" + (isUlt ? " ultimate" : "");
        btn.textContent = label;

        btn.addEventListener("mouseenter", () =>
          showSkillOverlay(btn, skill, champion),
        );
        btn.addEventListener("mouseleave", () => removeSkillOverlay());

        skillsBar.appendChild(btn);
      });

      skillsSection.appendChild(skillsBar);
      details.appendChild(skillsSection);
    }

    // Close when clicking on the backdrop
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeChampionOverlay();
    });

    // Close with Escape
    const handleEsc = (e) => {
      if (e.key === "Escape") closeChampionOverlay();
    };
    overlay._escHandler = handleEsc;
    document.addEventListener("keydown", handleEsc);

    return overlay;
  }

  function closeChampionOverlay() {
    if (!portraitOverlay) return;

    removeSkillOverlay();
    portraitOverlay.classList.remove("active");
    if (portraitOverlay._escHandler) {
      document.removeEventListener("keydown", portraitOverlay._escHandler);
    }

    const toRemove = portraitOverlay;
    portraitOverlay = null;
    setTimeout(() => toRemove.remove(), 200);
  }

  // --- Quick stats overlay (hover/touch on the portrait) ---

  function showQuickStatsOverlay(champion) {
    hideQuickStatsOverlay();
    if (!champion) return;

    quickStatsOverlay = document.createElement("div");
    quickStatsOverlay.className = "quick-stats-overlay";
    quickStatsOverlay.style.position = "fixed";
    quickStatsOverlay.style.zIndex = 13000;
    quickStatsOverlay.style.pointerEvents = "none";

    const statRows = [];

    // HP (text)
    statRows.push({ label: "HP", value: `${champion.HP}/${champion.maxHP}` });

    // Comparison-based numerics.
    statRows.push({
      label: "Attack",
      value: champion.Attack,
      base: champion.baseAttack,
    });
    statRows.push({
      label: "Defense",
      value: champion.Defense,
      base: champion.baseDefense,
    });
    statRows.push({
      label: "Speed",
      value: champion.Speed,
      base: champion.baseSpeed,
    });
    statRows.push({
      label: "Evasion",
      value: champion.Evasion ?? 0,
      base: champion.baseEvasion,
      percent: true,
    });
    statRows.push({
      label: "Critical",
      value: champion.Critical ?? 0,
      base: champion.baseCritical,
      percent: true,
    });
    statRows.push({
      label: "Life Steal",
      value: champion.LifeSteal ?? 0,
      base: champion.baseLifeSteal,
      percent: true,
    });

    let html = `<div class='quick-stats-content'>`;
    html += `<div class='quick-stats-title'>${champion.name}</div>`;
    html += `<div class='quick-stats-list'>`;

    for (const row of statRows) {
      let color = "#fff";
      let displayValue = row.value;

      if (typeof row.base === "number" && typeof row.value === "number") {
        if (row.value > row.base) color = "#00ff66";
        else if (row.value < row.base) color = "#ff2a2a";
      }
      if (row.percent && typeof row.value === "number") {
        displayValue = `${row.value}%`;
      }

      html += `
      <div class='quick-stat-row'>
        <span class='quick-stat-label'>${row.label}:</span>
        <span class='quick-stat-value' style='color:${color}'>
          ${displayValue}
        </span>
      </div>
    `;
    }

    html += `</div></div>`;

    quickStatsOverlay.innerHTML = html;
    document.body.appendChild(quickStatsOverlay);

    const portrait = document.querySelector(
      `.champion[data-champion-id='${champion.id}'] .portrait`,
    );

    if (portrait) {
      const rect = portrait.getBoundingClientRect();
      const overlayRect = quickStatsOverlay.getBoundingClientRect();

      let top = rect.top - overlayRect.height - 8;
      if (top < 0) top = rect.bottom + 8;

      let left = rect.left + (rect.width - overlayRect.width) / 2;
      if (left < 8) left = 8;

      if (left + overlayRect.width > window.innerWidth) {
        left = window.innerWidth - overlayRect.width - 8;
      }

      quickStatsOverlay.style.top = `${top}px`;
      quickStatsOverlay.style.left = `${left}px`;
    }
  }

  function hideQuickStatsOverlay() {
    if (quickStatsOverlay) {
      quickStatsOverlay.remove();
      quickStatsOverlay = null;
    }
  }

  return {
    showSkillOverlay,
    removeSkillOverlay,
    openChampionOverlay,
    closeChampionOverlay,
    showQuickStatsOverlay,
    hideQuickStatsOverlay,
  };
}
