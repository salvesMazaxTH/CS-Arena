import {
  getElementIdentity,
  renderIdentityIconMarkup,
} from "../../../shared/ui/identityPalette.js";
import {
  CLAIM_ACTION_KEY,
  getClaimPoints,
} from "../../../shared/engine/combat/claim.js";
import { GAME_GLOSSARY } from "../gameGlossary.js";
import { resolveText } from "../../../shared/i18n/locale.js";
import { getLocale } from "../i18n/clientLocale.js";
import { StatusEffectsRegistry } from "../../../shared/data/statusEffects/effectsRegistry.js";
import { EMBLEMS } from "../../../shared/data/emblems/index.js";
import { championDB } from "../../../shared/data/championDB.js";

/**
 * Hover/touch overlays: skill tooltips (with glossary), the champion portrait
 * overlay and the quick-stats popover. Owns its own DOM element references.
 * Depends on the live turn, the local player's team and the live champions,
 * injected as getters.
 */
export function createOverlays({
  getCurrentTurn,
  getPlayerTeam,
  getActiveChampions,
}) {
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

  // Every key and alias, longest first, so "Absolute Immunity" claims the whole
  // phrase before "absolute" can take its first word.
  const GLOSSARY_TERMS = Object.entries(GAME_GLOSSARY)
    .flatMap(([key, data]) =>
      [key, ...(data.aliases || [])].map((term) => ({ key, term })),
    )
    .sort((a, b) => b.term.length - a.term.length);

  // One alternation rather than one regex per term: matching the whole glossary
  // in a single pass is what stops a shorter term from claiming text a longer
  // one already took, and what keeps the markup below out of its own way.
  const GLOSSARY_PATTERN = new RegExp(
    GLOSSARY_TERMS.map(
      ({ term }) => `\\b(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\w*`,
    ).join("|"),
    "gi",
  );

  /** The key behind a match, found through whichever alternative filled a group. */
  function matchedKey(match) {
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) return GLOSSARY_TERMS[i - 1].key;
    }
    return null;
  }

  function extractGlossaryKeys(text) {
    const keys = new Set();

    for (const match of String(text ?? "").matchAll(GLOSSARY_PATTERN)) {
      const key = matchedKey(match);
      if (key) keys.add(key);
    }

    return [...keys];
  }

  function renderGlossaryStatusEffects(text) {
    if (!text) return text;

    return text.replace(GLOSSARY_PATTERN, (...args) => {
      const match = args.slice(0, -2);
      const key = matchedKey(match);
      if (!key) return match[0];

      return `<span class="glossary-statusEffect" data-key="${key}">${match[0]}</span>`;
    });
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

    const rawDesc = resolveText(
      typeof skill.description === "function"
        ? skill.description(champion)
        : skill.description || "",
      getLocale(),
    );

    const parsedDesc = renderGlossaryStatusEffects(rawDesc);
    const glossaryKeys = extractGlossaryKeys(rawDesc);

    const isClaim = skill?.key === CLAIM_ACTION_KEY;
    const claimPoints = isClaim
      ? getClaimPoints(champion, getCurrentTurn())
      : null;

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
          <span class="meta-label">CLAIM Value:</span>
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
            skill.bf || skill.bfPerHit
              ? `
            <div class="skill-meta-item">
              <span class="meta-label">BF:</span>
              <span class="meta-value">${
                skill.bf ? `${skill.bf}%` : `${skill.bfPerHit}% per hit`
              }</span>
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
              ${renderIdentityIconMarkup(getElementIdentity(skill.element), {
                className: "skill-overlay-element-icon",
                alt: skill.element,
              })}
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
    parsedDesc
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

  // --- Modifier ledger (portrait overlay) ---

  // Critical, Evasion and Life Steal are percentages already, so their
  // modifiers read as points and have no "of base" comparison.
  const STAT_CATEGORIES = [
    { stat: "Attack", label: "Attack", base: "baseAttack" },
    { stat: "Defense", label: "Defense", base: "baseDefense" },
    { stat: "Speed", label: "Speed", base: "baseSpeed" },
    { stat: "maxHP", label: "Max HP", base: "baseHP" },
    { stat: "Critical", label: "Critical", points: true },
    { stat: "Evasion", label: "Evasion", points: true },
    { stat: "LifeSteal", label: "Life Steal", points: true },
  ];

  const humanizeKey = (key) =>
    String(key ?? "")
      .replace(/[-_]hook$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

  const localized = (value) => resolveText(value ?? "", getLocale());

  /** A live champion by id, or its roster entry when it has left the field. */
  function findChampion(id) {
    if (!id) return null;
    return (
      getActiveChampions()?.get(id) ??
      championDB[String(id).split("-")[0]] ??
      null
    );
  }

  /** Player-facing name of whatever created a modifier. */
  function originLabel(origin, holder) {
    if (!origin?.key) return null;
    const owner = findChampion(origin.ownerId);
    const byOther = owner && origin.ownerId !== holder.id;
    const withOwner = (name) =>
      byOther ? `${name} (${localized(owner.name)})` : name;

    switch (origin.kind) {
      case "skill": {
        const skill = owner?.skills?.find((s) => s.key === origin.key);
        return withOwner(
          skill ? localized(skill.name) : humanizeKey(origin.key),
        );
      }
      case "passive":
        return withOwner(
          owner?.passive?.name
            ? localized(owner.passive.name)
            : humanizeKey(origin.key),
        );
      case "status":
        return (
          StatusEffectsRegistry[origin.key]?.name ?? humanizeKey(origin.key)
        );
      case "emblem":
        return (
          EMBLEMS.find((e) => e.key === origin.key)?.name ??
          humanizeKey(origin.key)
        );
      default:
        return humanizeKey(origin.key);
    }
  }

  const signed = (n, suffix = "") =>
    `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${suffix}`;

  /** "+30% +15", dropping whichever half is zero. */
  const percentAndFlat = (percent, flat) =>
    [percent ? signed(percent, "%") : null, flat ? signed(flat) : null]
      .filter(Boolean)
      .join(" ") || "±0";

  const tone = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

  function turnsLeft(expiresAtTurn, permanent) {
    if (permanent || !Number.isFinite(expiresAtTurn)) return null;
    const left = expiresAtTurn - (getCurrentTurn() ?? 0);
    return left > 0 ? left : null;
  }

  /** Sums entries sharing a label, so ten stacks read as one line ×10. */
  function mergeByLabel(entries) {
    const merged = new Map();
    for (const entry of entries) {
      const prev = merged.get(entry.label);
      if (!prev) {
        merged.set(entry.label, { ...entry, count: 1 });
        continue;
      }
      prev.count++;
      prev.values = prev.values.map((v, i) =>
        v === null || entry.values[i] === null ? null : v + entry.values[i],
      );
      prev.turns =
        prev.turns === null || entry.turns === null
          ? null
          : Math.max(prev.turns, entry.turns);
    }
    return [...merged.values()];
  }

  /** Share of positive vs negative weight, for a column's balance bar. */
  function balanceOf(values) {
    const up = values.filter((v) => v > 0).reduce((s, v) => s + v, 0);
    const down = values.filter((v) => v < 0).reduce((s, v) => s - v, 0);
    const whole = up + down || 1;
    return { up: up / whole, down: down / whole };
  }

  function statColumns(champion) {
    const mods = champion.statModifiers ?? [];
    return STAT_CATEGORIES.flatMap(({ stat, label, base, points }) => {
      const own = mods.filter((m) => m.statName === stat && m.amount !== 0);
      if (!own.length) return [];

      const total = own.reduce((sum, m) => sum + m.amount, 0);
      const baseValue = base ? champion[base] : null;
      const unit = points ? "%" : "";
      const relative =
        baseValue > 0 ? Math.round((total / baseValue) * 100) : null;

      const rows = mergeByLabel(
        own.map((m) => ({
          label:
            originLabel(m.origin, champion) ??
            (m.statusKey
              ? StatusEffectsRegistry[m.statusKey]?.name ??
                humanizeKey(m.statusKey)
              : "Unknown source"),
          values: [m.amount],
          turns: turnsLeft(m.expiresAtTurn, m.isPermanent),
        })),
      ).map((row) => ({
        ...row,
        display: signed(row.values[0], unit),
        sign: row.values[0],
      }));

      return [
        {
          label,
          total: signed(total, unit),
          sub:
            relative !== null
              ? `${signed(relative, "%")} over base ${baseValue}`
              : null,
          sign: total,
          balance: balanceOf(own.map((m) => m.amount)),
          rows,
        },
      ];
    });
  }

  function damageDealtColumn(champion) {
    const mods = champion.damageModifiers ?? [];
    if (!mods.length) return [];

    // Modifiers apply one after another in array order, so composing their
    // "x * factor + flat" maps gives the exact combined effect.
    let factor = 1;
    let flat = 0;
    for (const m of mods) {
      // Target-dependent modifiers have no fixed value to fold in.
      if (m.percent === null || m.flat === null) continue;
      const f = 1 + m.percent / 100;
      factor *= f;
      flat = flat * f + m.flat;
    }
    const percent = Math.round((factor - 1) * 100);

    const rows = mergeByLabel(
      mods.map((m) => ({
        label: originLabel(m.origin, champion) ?? m.name ?? humanizeKey(m.id),
        values: [m.percent, m.flat],
        turns: turnsLeft(m.expiresAtTurn, m.permanent),
      })),
    ).map((row) => {
      const [p, f] = row.values;
      if (p === null || f === null) {
        return { ...row, display: "varies", sign: 0 };
      }
      return { ...row, display: percentAndFlat(p, f), sign: p || f };
    });

    return [
      {
        label: "Damage dealt",
        total: percentAndFlat(percent, Math.round(flat)),
        sign: percent || flat,
        balance: balanceOf(rows.map((r) => r.sign)),
        rows,
      },
    ];
  }

  function damageReductionColumn(champion) {
    const mods = (champion.damageReductionModifiers ?? []).filter(
      (m) => m.amount !== 0,
    );
    if (!mods.length) return [];

    const sum = (type) =>
      mods.filter((m) => m.type === type).reduce((s, m) => s + m.amount, 0);
    const stackedPercent = sum("percent");
    const percent = Math.min(stackedPercent, 100);
    const flat = sum("flat");

    const rows = mergeByLabel(
      mods.map((m) => ({
        label:
          originLabel(m.origin, champion) ??
          (m.source ? humanizeKey(m.source) : "Unknown source"),
        values: [
          m.type === "percent" ? m.amount : 0,
          m.type === "flat" ? m.amount : 0,
        ],
        turns: turnsLeft(m.expiresAtTurn, false),
      })),
    ).map((row) => {
      const [p, f] = row.values;
      return { ...row, display: percentAndFlat(p, f), sign: p || f };
    });

    return [
      {
        label: "Damage reduction",
        total: percentAndFlat(percent, flat),
        sub:
          stackedPercent > 100
            ? `capped at 100% (${stackedPercent}% stacked)`
            : null,
        sign: percent || flat,
        balance: balanceOf(rows.map((r) => r.sign)),
        rows,
      },
    ];
  }

  function effectChips(champion) {
    const chips = [];
    const statuses =
      champion.statusEffects instanceof Map
        ? [...champion.statusEffects.entries()]
        : [];
    for (const [key, data] of statuses) {
      const entry = StatusEffectsRegistry[key];
      chips.push({
        label: entry?.name ?? humanizeKey(key),
        type: entry?.type ?? null,
        stacks: data?.stacks ?? 0,
        turns: turnsLeft(data?.expiresAtTurn, false),
      });
    }
    for (const effect of champion.runtime?.hookEffectData ?? []) {
      chips.push({
        label: humanizeKey(effect.key),
        type: effect.type,
        stacks: effect.stacks ?? 0,
        turns: turnsLeft(effect.expiresAtTurn, false),
      });
    }
    return chips;
  }

  /**
   * Every live modifier on the champion, one column per category with its
   * combined total on top and each source itemized below, plus a strip of
   * active effects.
   */
  function renderModifierLedger(champion) {
    const columns = [
      ...statColumns(champion),
      ...damageDealtColumn(champion),
      ...damageReductionColumn(champion),
    ];
    const chips = effectChips(champion);

    const ledger = document.createElement("section");
    ledger.className = "modifier-ledger";
    ledger.setAttribute("aria-label", "Active modifiers");

    if (!columns.length && !chips.length) {
      ledger.innerHTML = `<div class="ledger-panel"><p class="modifier-ledger-empty">No active modifiers on ${escapeHtml(champion.name)}.</p></div>`;
      return ledger;
    }

    const turnsMarkup = (turns) =>
      turns
        ? `<span class="ledger-turns" title="${turns} turn(s) left">${turns}t</span>`
        : "";
    const countMarkup = (count) =>
      count > 1 ? ` <span class="ledger-count">×${count}</span>` : "";

    const columnsHtml = columns
      .map(
        (col) => `
      <div class="ledger-col" data-tone="${tone(col.sign)}">
        <div class="ledger-head">
          <span class="ledger-label">${escapeHtml(col.label)}</span>
          <span class="ledger-total">${escapeHtml(col.total)}</span>
        </div>
        <div class="ledger-balance" aria-hidden="true">
          <span class="ledger-balance-down" style="--share:${col.balance.down}"></span>
          <span class="ledger-balance-up" style="--share:${col.balance.up}"></span>
        </div>
        ${col.sub ? `<div class="ledger-sub">${escapeHtml(col.sub)}</div>` : ""}
        <ul class="ledger-rows">
          ${col.rows
            .map(
              (row) => `
            <li class="ledger-row" data-tone="${tone(row.sign)}">
              <span class="ledger-source" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}${countMarkup(row.count)}</span>
              ${turnsMarkup(row.turns)}
              <span class="ledger-value">${escapeHtml(row.display)}</span>
            </li>`,
            )
            .join("")}
        </ul>
      </div>`,
      )
      .join("");

    const chipsHtml = chips.length
      ? `<ul class="ledger-chips" aria-label="Active effects">
          ${chips
            .map(
              (chip) => `
            <li class="ledger-chip" data-type="${escapeHtml(chip.type ?? "neutral")}">${escapeHtml(chip.label)}${countMarkup(chip.stacks)}${turnsMarkup(chip.turns)}</li>`,
            )
            .join("")}
        </ul>`
      : "";

    ledger.innerHTML = `
      <div class="ledger-panel">
        ${columns.length ? `<div class="ledger-cols">${columnsHtml}</div>` : ""}
        ${chipsHtml}
      </div>
    `;
    return ledger;
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

    const rawPassiveDesc = resolveText(
      typeof passive?.description === "function"
        ? passive.description(champion)
        : passive?.description || "",
      getLocale(),
    );

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

    const isEnemyChampion =
      getPlayerTeam() !== null && champion.team !== getPlayerTeam();

    // Enemy CLAIM value: the points they would score by CLAIMing this turn.
    if (isEnemyChampion) {
      const claimSection = document.createElement("div");
      claimSection.classList.add("portrait-overlay-enemy-claim");

      const claimTitle = document.createElement("h3");
      claimTitle.classList.add("portrait-overlay-details-title");
      claimTitle.textContent = "CLAIM Value";
      claimSection.appendChild(claimTitle);

      const claimValue = document.createElement("span");
      claimValue.classList.add("portrait-overlay-enemy-claim-value");
      claimValue.textContent = `${getClaimPoints(champion, getCurrentTurn())} point(s)`;
      claimSection.appendChild(claimValue);

      details.appendChild(claimSection);
    }

    // Enemy champion skills (fake action bar)
    if (
      isEnemyChampion &&
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

    overlay.appendChild(renderModifierLedger(champion));

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
