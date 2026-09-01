import {
  getExclusiveIndicator,
  getRuntimeCounterIndicatorEntries,
} from "../indicators/exclusiveIndicators.js";

// Boxicons arrow icons for stat buffs/debuffs
const BUFF_ICON = {
  type: "icon",
  value:
    "<i class='bx bxs-up-arrow' style='color:#00c853;font-size:1.5em;'></i>",
  background: "rgba(0,255,0,0.15)",
  name: "buff",
};
const DEBUFF_ICON = {
  type: "icon",
  value:
    "<i class='bx bxs-down-arrow' style='color:#d50000;font-size:1.5em;'></i>",
  background: "rgba(255,0,0,0.15)",
  name: "debuff",
};

function syncStatusStackBadge(indicator, icon, effectData) {
  if (!indicator) return;

  const currentBadge = indicator.querySelector(".status-indicator-stack-badge");
  const stackCount = Number(effectData?.stacks ?? effectData?.stackCount) || 0;
  const shouldShowBadge = Boolean(icon?.showStackCount) && stackCount > 0;

  if (!shouldShowBadge) {
    currentBadge?.remove();
    return;
  }

  const badge = currentBadge || document.createElement("span");
  badge.className = "status-indicator-stack-badge";
  badge.textContent = String(stackCount);

  if (!currentBadge) {
    indicator.appendChild(badge);
  }
}
/**
 * Champion status indicator system — visual icons and effects based on statusEffects
 */
export const StatusIndicator = {
  // statusEffects → icons and backgrounds
  statusEffectIcons: {
    paralyzed: {
      type: "image",
      value: "/assets/indicators/paralyzed_indicator.png",
      background: "none",
      label: "Paralyzed",
    },
    stunned: {
      type: "emoji",
      value: "💫",
      background: "rgba(241, 241, 241, 0.8)",
      label: "Stunned",
    },
    chilled: {
      type: "emoji",
      value: "❄️",
      background: "rgba(173, 216, 230, 0.8)",
      label: "Chilled",
    },
    frozen: {
      type: "emoji",
      value: "❄️",
      background: "rgba(16, 216, 230, 0.8)",
      label: "Frozen",
    },
    inert: {
      type: "emoji",
      value: "🔒",
      background: "rgba(128, 128, 128, 0.8)",
      label: "Inert",
    },
    conductor: {
      type: "emoji",
      value: "⚡",
      background: "rgba(255, 255, 0, 0.8)",
      label: "Conductor",
    },
    absoluteimmunity: {
      type: "image",
      value: "/assets/indicators/absolute_immunity_indicator.png",
      background: "none",
      label: "Absolute Immunity",
    },
    debuffimmunity: {
      type: "image",
      value: "/assets/indicators/debuffImmunity_indicator.png",
      background: "rgba(120, 200, 160, 0.8)",
      label: "Affliction Ward",
    },
    burning: {
      type: "emoji",
      value: "🔥",
      background: "rgba(255, 69, 0, 0.8)",
      label: "Burning",
    },
    bleeding: {
      type: "emoji",
      value: "🩸",
      background: "rgba(170, 0, 20, 0.88)",
      label: "Bleeding",
      showStackCount: true,
    },
    poisoned: {
      type: "image",
      value: "/assets/indicators/poisoned_indicator.png",
      background: "rgba(80, 255, 80, 0.88)",
      label: "Poisoned",
      showStackCount: true,
    },
    rooted: {
      type: "image",
      value: "/assets/indicators/rooted_indicator.png",
      background: "none",
      label: "Rooted",
    },
    snared: {
      type: "image",
      value: "/assets/indicators/snared_indicator.png",
      background: "none",
      label: "Snared",
    },
    healblock: {
      type: "image",
      value: "/assets/indicators/healBlock_indicator.png",
      background: //"rgba(170, 0, 20, 0.88)", 
      "black",
      label: "Heal Block",
    },
    taunted: {
      type: "image",
      value: "/assets/indicators/taunted_indicator.png",
      background: "",
      label: "Taunted",
    },
  },

  // Minimum visual duration for indicators (ms)
  VISUAL_DELAY: 1500,

  // Controle de rotação por champion
  //_rotationTimers: new Map(),
  ROTATION_INTERVAL: 1750,
  _rotationTimer: null,
  _rotationIndex: 0,

  /**
   * Update champion's status indicators based on active statusEffects
   * @param {Champion} champion
   */
  updateChampionIndicators(champion) {
    if (!champion.el) return;

    const portrait = champion.el.querySelector(".portrait");
    if (!portrait) return;

    // An effect applied with hiddenIndicator carries no icon at all.
    const activeStatuses = new Set(
      [...champion.statusEffects.entries()]
        .filter(([, effect]) => !effect?.hiddenIndicator)
        .map(([key]) => String(key).toLowerCase()),
    );
    const hookEffectData = Array.isArray(champion.runtime?.hookEffectData)
      ? champion.runtime.hookEffectData
      : [];
    for (const hook of hookEffectData) {
      activeStatuses.add(hook.key);
    }
    const hasActiveTaunt =
      Array.isArray(champion.tauntEffects) && champion.tauntEffects.length > 0;

    if (hasActiveTaunt) {
      activeStatuses.add("taunted");
    }

    // Runtime-counter indicators (e.g. Zyrelle's ammo): active whenever the
    // backing champion.runtime field is defined, badge sourced from it below.
    const runtimeCounters = getRuntimeCounterIndicatorEntries();
    for (const entry of runtimeCounters) {
      if (champion.runtime?.[entry.runtimeKey] !== undefined) {
        activeStatuses.add(entry.statusKey);
      }
    }

    // --- BUFF/DEBUFF INDICATORS ---
    // Remove existing buff/debuff indicators
    portrait
      .querySelectorAll(".status-indicator-buff, .status-indicator-debuff")
      .forEach((el) => el.remove());

    // Detect active buffs/debuffs
    let hasBuff = false;
    let hasDebuff = false;
    // Buff: positive statModifiers, damageModifiers (presence = buff), positive damageReduction
    if (
      Array.isArray(champion.statModifiers) &&
      champion.statModifiers.some((m) => m.amount > 0)
    )
      hasBuff = true;
    if (
      (Array.isArray(champion.damageModifiers) &&
        champion.damageModifiers.length > 0) ||
      champion.damageModifiersCount > 0
    )
      hasBuff = true;
    if (
      (Array.isArray(champion.damageReductionModifiers) &&
        champion.damageReductionModifiers.length > 0) ||
      champion.damageReductionModifiersCount > 0
    )
      hasBuff = true;
    // Debuff: negative statModifiers
    if (
      Array.isArray(champion.statModifiers) &&
      champion.statModifiers.some((m) => m.amount < 0)
    )
      hasDebuff = true;

    // Add buff indicator
    if (hasBuff) {
      const buffDiv = document.createElement("div");
      buffDiv.className = "status-indicator status-indicator-buff";
      buffDiv.dataset.statusEffect = "buff";
      buffDiv.title = "Buff";
      buffDiv.innerHTML = BUFF_ICON.value;
      buffDiv.style.backgroundColor = BUFF_ICON.background;
      portrait.appendChild(buffDiv);
    }
    // Add debuff indicator
    if (hasDebuff) {
      const debuffDiv = document.createElement("div");
      debuffDiv.className = "status-indicator status-indicator-debuff";
      debuffDiv.dataset.statusEffect = "debuff";
      debuffDiv.title = "Debuff";
      debuffDiv.innerHTML = DEBUFF_ICON.value;
      debuffDiv.style.backgroundColor = DEBUFF_ICON.background;
      portrait.appendChild(debuffDiv);
    }

    // remove stale indicators
    portrait.querySelectorAll(".status-indicator").forEach((el) => {
      if (
        el.classList.contains("status-indicator-buff") ||
        el.classList.contains("status-indicator-debuff")
      )
        return; // buff/debuff arrows managed above
      const name = el.dataset.statusEffect?.toLowerCase();
      if (!activeStatuses.has(name) && !el.classList.contains("visual-delay")) {
        el.remove();
      }
    });

    for (const statusEffectName of activeStatuses) {
      const runtimeCounter = runtimeCounters.find(
        (entry) => entry.statusKey === statusEffectName,
      );
      const effectData = runtimeCounter
        ? { stacks: champion.runtime[runtimeCounter.runtimeKey] }
        : champion.statusEffects.get(statusEffectName) ||
          hookEffectData.find((hook) => hook.key === statusEffectName) ||
          null;
      const icon =
        this.statusEffectIcons[statusEffectName.toLowerCase()] ||
        getExclusiveIndicator(statusEffectName);
      if (!icon) continue;

      let indicator = portrait.querySelector(
        `[data-status-effect="${statusEffectName}"]`,
      );

      if (!indicator) {
        const existing = portrait.querySelectorAll(
          `[data-status-effect="${statusEffectName}"]`,
        );

        if (existing.length > 0) {
          indicator = existing[0];
        } else {
          indicator = document.createElement("div");
        }

        indicator.className = "status-indicator";
        indicator.dataset.statusEffect = statusEffectName;
        indicator.title = icon.label || statusEffectName;

        // Safe class
        const safe = statusEffectName
          .toLowerCase()
          .replace(/\s+/g, "_")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        indicator.classList.add(`status-${safe}`);

        // Conteúdo visual
        if (icon.type === "emoji") {
          indicator.textContent = icon.value;
          indicator.style.fontSize = "1.75em";
        } else if (icon.type === "text") {
          indicator.textContent = icon.value;
          indicator.style.color = icon.color || "#ffffff";
          indicator.style.left = "45%";
          indicator.style.top = "12%";
          indicator.style.fontSize = "1.55em";
          indicator.style.fontWeight = "bold";
        } else {
          const img = document.createElement("img");
          img.src = icon.value;
          img.alt = icon.label || statusEffectName;
          img.className = "indicator-image";
          indicator.appendChild(img);
        }

        if (icon.background === "none") {
          indicator.style.background = "none";
        } else {
          indicator.style.background = icon.background || "rgba(0, 0, 0, 0.6)";
        }

        portrait.appendChild(indicator);
      }

      const stackCount =
        Number(effectData?.stacks ?? effectData?.stackCount) || 0;
      indicator.title =
        stackCount > 1
          ? `${icon.label || statusEffectName} x${stackCount}`
          : icon.label || statusEffectName;

      syncStatusStackBadge(indicator, icon, effectData);
    }

    // When multiple indicators exist, show only the current rotation index
    const allIndicators = portrait.querySelectorAll(".status-indicator");
    if (allIndicators.length > 1) {
      allIndicators.forEach((el, i) => {
        el.style.opacity =
          i === this._rotationIndex % allIndicators.length ? "1" : "0";
      });
    } else if (allIndicators.length === 1) {
      allIndicators[0].style.opacity = "1";
    }

    this.syncRotationLoopState();
  },

  hasAnyActiveIndicators() {
    const portraits = document.querySelectorAll(".champion .portrait");
    for (const portrait of portraits) {
      if (portrait.querySelectorAll(".status-indicator").length > 1) {
        return true;
      }
    }

    return false;
  },

  syncRotationLoopState() {
    if (this.hasAnyActiveIndicators()) {
      this.startRotationLoop();
      return;
    }

    this.stopRotationLoop();
  },

  startRotationLoop() {
    if (this._rotationTimer !== null) return;

    this._rotationTimer = setInterval(() => {
      this._rotationIndex++;

      document.querySelectorAll(".champion").forEach((championEl) => {
        const portrait = championEl.querySelector(".portrait");
        if (!portrait) return;

        const indicators = portrait.querySelectorAll(".status-indicator");
        if (indicators.length <= 1) return;

        indicators.forEach((el, i) => {
          el.style.opacity =
            i === this._rotationIndex % indicators.length ? "1" : "0";
        });
      });
    }, this.ROTATION_INTERVAL);
  },

  stopRotationLoop() {
    if (this._rotationTimer !== null) {
      clearInterval(this._rotationTimer);
      this._rotationTimer = null;
      this._rotationIndex = 0;
    }
  },
};
