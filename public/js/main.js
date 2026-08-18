//============================================================
//  SKILL OVERLAYS (HOVER/TOUCH ON SKILL BUTTONS, AND CLICK ON PORTRAIT)
// ============================================================

import { elementEmoji } from "../../shared/ui/elementEmoji.js";
import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
  CLAIM_MAX_POINTS,
} from "../../shared/engine/combat/claim.js";

let skillOverlay = null;

function extractGlossaryKeys(text) {
  const keys = new Set();

  for (const [key, data] of Object.entries(GAME_GLOSSARY)) {
    const terms = [key, ...(data.aliases || [])];

    for (const term of terms) {
      const regex = new RegExp(`\\b${term}\\w*`, "i");

      if (regex.test(text)) {
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

// =========================
// Helpers (outside the function)
// =========================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toParagraphs(text) {
  return String(text ?? "").replace(/\n/g, "<br>");
}

function getClaimPointsPreview(champion) {
  if (!champion) return 0;

  const momentum = Math.max(0, Number(champion?.momentum) || 0);
  if (momentum < CLAIM_MIN_MOMENTUM) {
    return 0;
  }

  const momentumPoints =
    momentum >= 75
      ? 3
      : momentum >= 50
        ? 2
        : momentum >= 25
          ? 1
          : 0;
  const fieldEntryTurn = Number.isFinite(champion?.runtime?.fieldEntryTurn)
    ? Number(champion.runtime.fieldEntryTurn)
    : currentTurn;
  const turnsInField = Math.max(0, currentTurn - fieldEntryTurn);

  return Math.min(CLAIM_MAX_POINTS, momentumPoints + turnsInField);
}

// =========================
// Skill Overlay
// =========================

function showSkillOverlay(button, skill, champion) {
  removeSkillOverlay();
  if (!button || !skill) return;

  const overlay = document.createElement("div");
  overlay.className = "skill-hover-overlay";

  // =========================
  // Skill data
  // =========================

  const rawDesc =
    typeof skill.description === "function"
      ? skill.description(champion)
      : skill.description || "";

  const parsedDesc = renderGlossaryStatusEffects(rawDesc);
  const glossaryKeys = extractGlossaryKeys(rawDesc);

  const isClaim = skill?.key === CLAIM_ACTION_KEY;

  const claimPoints = isClaim ? getClaimPointsPreview(champion) : null;

  const momentumCost =
    skill.isUltimate && Number.isInteger(skill.momentumCost)
      ? skill.momentumCost
      : null;

  // =========================
  // HTML
  // =========================

  overlay.innerHTML = `

  <div class="skill-overlay-title">
    ${escapeHtml(skill.name || "Habilidade")}
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

  // =========================
  // Glossary
  // =========================

  let glossaryPanel = null;

  if (glossaryKeys.length) {
    glossaryPanel = renderGlossaryPanel(glossaryKeys);
    document.body.appendChild(glossaryPanel);
  }

  // =========================
  // Overlay Positioning
  // =========================

  const buttonRect = button.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();

  let top = buttonRect.bottom + 8;
  let left = buttonRect.left + buttonRect.width / 2 - overlayRect.width / 2;

  if (top + overlayRect.height > window.innerHeight) {
    top = buttonRect.top - overlayRect.height - 8;
  }

  left = Math.max(8, Math.min(left, window.innerWidth - overlayRect.width - 8));

  overlay.style.position = "fixed";
  overlay.style.top = `${Math.max(8, top)}px`;
  overlay.style.left = `${left}px`;
  overlay.style.zIndex = 15000;

  // =========================
  // Glossary Panel Positioning
  // =========================

  if (glossaryPanel) {
    const overlayBox = overlay.getBoundingClientRect();

    glossaryPanel.style.position = "fixed";
    glossaryPanel.style.top = `${overlayBox.bottom + 6}px`;
    glossaryPanel.style.left = `${overlayBox.left}px`;
    glossaryPanel.style.zIndex = 15000;
  }

  // =========================
  // Fade in
  // =========================

  requestAnimationFrame(() => overlay.classList.add("active"));
}

// =========================
// Remove overlay
// =========================

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

function openChampionOverlay(champion) {
  if (!champion) return;
  if (portraitOverlay) closeOverlay();

  portraitOverlay = createChampionOverlay(champion);
  document.body.appendChild(portraitOverlay);
  requestAnimationFrame(() => portraitOverlay.classList.add("active"));
}

function createChampionOverlay(champion) {
  const overlay = document.createElement("div");
  overlay.classList.add("portrait-overlay");

  // --- Helpers de sanitização ---
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

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

  const toParagraphs = (text) => String(text ?? "").replace(/\n/g, "<br>");

  // --- Passiva ---
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

  // =========================
  // Glossário da passiva
  // =========================

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
    playerTeam !== null &&
    champion.team !== playerTeam &&
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
      const label = isUlt ? `ULT — ${skill.name}` : skill.name;

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

// ============================================================
//  IMPORTS
// ============================================================

import { championDB } from "/shared/data/championDB.js";
import { Champion } from "/shared/core/Champion.js";
import { StatusIndicator } from "../../shared/ui/statusIndicator.js";
import { createCombatAnimationManager } from "./animation/animsAndLogManager.js";
import { GAME_GLOSSARY } from "./gameGlossary.js";
import { syncChampionVFX } from "../../shared/vfx/vfxManager.js";
import { audioManager } from "./utils/AudioManager.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";

// ============================================================
//  SOCKET
// ============================================================

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

// Restore player name display logic (without score)
socket.on("playerNamesUpdate", (namesArray) => {
  playerNames.clear();
  namesArray.forEach(([slot, name]) => playerNames.set(parseInt(slot), name));
  updatePlayerNamesUI();
});

function updatePlayerNamesUI() {
  const player1NameDisplayEl = document.getElementById("player1-name-display");
  const player2NameDisplayEl = document.getElementById("player2-name-display");

  const player1Name = playerNames.get(0);
  const player2Name = playerNames.get(1);

  if (player1NameDisplayEl) {
    player1NameDisplayEl.textContent =
      playerTeam === 1 ? "You" : `Opponent (${player1Name || "Unknown"})`;
  }
  if (player2NameDisplayEl) {
    player2NameDisplayEl.textContent =
      playerTeam === 2 ? "You" : `Opponent (${player2Name || "Unknown"})`;
  }
}

// ============================================================
//  SETTINGS (overridden by the server via "editModeUpdate")
//  Only UI/UX properties — the server filters sensitive fields
//  like damageOutput before sending.
// ============================================================

const editMode = {
  enabled: false,
  autoLogin: false,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unavailableChampions: false,
  freeCostSkills: false, // Skills do not consume resources. (CLIENT-ONLY)
};

// ============================================================
//  ESTADO DO JOGO
// ============================================================

// --- Identidade do jogador ---
let playerId = null;
let playerTeam = null;
let username = null;
const playerNames = new Map(); // slot → nome de usuário

// Reserva/switch desativados.
// const teamReserveQueue = new Map(); // team → string[]

// --- Turn & Combat ---
let currentTurn = 1;
let hasConfirmedEndTurn = false;
let gameEnded = false;

// --- Active champions in the field ---
const activeChampions = new Map();

// --- Champion Selection ---
const TEAM_SIZE = 8;
let selectedChampions = Array(TEAM_SIZE).fill(null);
let championSelectionTimer = null;
let championSelectionTimeLeft = 0;
let playerTeamConfirmed = false;
/* let allAvailableChampionKeys = []; */
let draggedChampionKey = null;
let draggedFromSlotIndex = -1; // -1 = available grid, >= 0 = selected slot

// --- Timers ---
let disconnectionCountdownInterval = null;
let countdownInterval = null;

// --- Overlays ---
let portraitOverlay = null;
const EMBLEM_MAX_SELECTION = 2;
let playerEmblems = [];
let selectedEmblemKeys = [];
let emblemTooltip = null;

// ============================================================
//  DOM REFERENCES
// ============================================================

// --- Login Screen ---
const loginScreen = document.getElementById("login-screen");
const usernameInput = document.getElementById("username-input");
const joinArenaBtn = document.getElementById("join-arena-btn");
const loginMessage = document.getElementById("login-message");
const disconnectionMessage = document.getElementById("disconnection-message");

// --- Main content (arena) ---
const mainContent = document.getElementById("main-content");
const skipSlotBtn = document.querySelector("#skip-slot-btn");
const combatDialog = document.getElementById("combat-dialog");
const combatDialogText = document.getElementById("combat-dialog-text");

// --- Champion Selection ---
const championSelectionScreen = document.getElementById(
  "champion-selection-screen",
);
const availableChampionsGrid = document.getElementById(
  "availableChampionsGrid",
);
const selectedChampionsSlots = document.getElementById(
  "selectedChampionsSlots",
);
const autofillTeamBtn = document.getElementById("autofillTeamBtn");
const confirmTeamBtn = document.getElementById("confirmTeamBtn");
const teamSelectionMessage = document.getElementById("team-selection-message");
const emblemSelectionList = document.getElementById("emblemSelectionList");
const selectedEmblemsCount = document.getElementById("selectedEmblemsCount");

// --- Game Over ---
const gameOverOverlay = document.getElementById("gameOverOverlay");
const returnToLoginBtn = document.getElementById("returnToLoginBtn");

// --- Surrender (Give Up) ---
const surrenderBtn = document.getElementById("surrender-btn");
const surrenderOverlay = document.getElementById("surrender-overlay");
const surrenderCancel = document.getElementById("surrender-cancel");
const surrenderConfirm = document.getElementById("surrender-confirm");

// --- Audio Settings (UI) ---
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const musicToggle = document.getElementById("music-toggle");
const musicVolumeSlider = document.getElementById("music-volume");
const sfxToggle = document.getElementById("sfx-toggle");
const sfxVolumeSlider = document.getElementById("sfx-volume");

// --- Campeões de retaguarda (reserva) desativados ---
// const backChampionDisplayTeam1 = document.getElementById(
//   "backChampionDisplayTeam1",
// );
// const backChampionDisplayTeam2 = document.getElementById(
//   "backChampionDisplayTeam2",
// );

// ============================================================
//  GLOBAL EXPORTS (used by AnimsAndLogManager and others)
// ============================================================

window.StatusIndicator = StatusIndicator;
window.gameEnded = gameEnded;
window.resetCombat = () => {
  if (!editMode.enabled) return;
  socket.emit("debugResetCombat");
};

// ============================================================
//  COMBAT ANIMATIONS MANAGER
// ============================================================

const combatAnimations = createCombatAnimationManager({
  activeChampions,
  createNewChampion,
  getCurrentTurn: () => currentTurn,
  setCurrentTurn: (turn) => {
    currentTurn = turn;
  },
  updateTurnDisplay,
  applyTurnUpdate,
  syncStatusIndicatorRotation: () => StatusIndicator.syncRotationLoopState(),
  combatDialog,
  combatDialogText,
  editMode,

  onQueueEmpty: () => {
    socket.emit("combatAnimationsFinished");
  },

  onGameStateProcessed: () => {
    if (playerTeam !== null) initActionBar();
  },

  onChampionReplaced: () => {
    sortTeamContainersByCombatSlot();
  },
});

// ============================================================
//  AUDIO
// ============================================================

audioManager.preloadAll();

// ============================================================
//  AUDIO SETTINGS (UI)
// ============================================================

function openSettings() {
  settingsOverlay.classList.remove("hidden");
  // Pequeno delay para a animação CSS
  setTimeout(() => settingsOverlay.classList.add("active"), 10);
}

function closeSettings(immediate = false) {
  settingsOverlay.classList.remove("active");
  if (immediate) {
    settingsOverlay.classList.add("hidden");
    return;
  }
  setTimeout(() => settingsOverlay.classList.add("hidden"), 300);
}

settingsBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);

settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

// Synchronization with AudioManager
musicToggle.addEventListener("change", (e) => {
  audioManager.toggleMusic(e.target.checked);
});

musicVolumeSlider.addEventListener("input", (e) => {
  audioManager.setMusicVolume(parseFloat(e.target.value));
});

sfxToggle.addEventListener("change", (e) => {
  audioManager.toggleSFX(e.target.checked);
});

sfxVolumeSlider.addEventListener("input", (e) => {
  audioManager.setSFXVolume(parseFloat(e.target.value));
});

// ============================================================
//  LOGIN & CONNECTION
// ============================================================

socket.on("editModeUpdate", (serverEditMode = {}) => {
  Object.assign(editMode, serverEditMode);
  // Auto-login in edit mode: if server enabled autoLogin, fill username and join
  if (editMode.enabled && editMode.autoLogin) {
    // 🔥 request slot automatically
    socket.emit("requestPlayerSlot");
  }
});

joinArenaBtn.addEventListener("click", () => {
  const enteredUsername = usernameInput.value.trim();
  if (enteredUsername) {
    username = enteredUsername;
    socket.emit("requestPlayerSlot", username);
    loginMessage.textContent = "Connecting...";
    joinArenaBtn.disabled = true;
    usernameInput.disabled = true;
  } else {
    loginMessage.textContent = "Please enter a username.";
  }
});

usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinArenaBtn.click();
  }
});

socket.on("playerAssigned", (data) => {
  playerId = data.playerId;
  playerTeam = data.team;
  username = data.username;
  window.playerTeam = playerTeam;

  const initialEmblems = Array.isArray(data.emblems) ? data.emblems : [];
  playerEmblems = initialEmblems.slice();
  selectedEmblemKeys = [...playerEmblems];
  renderEmblemSelectionUI();
  renderPlayerEmblemStrip();

  // Mirror the arena so the local player always appears on top in blue
  const arena = document.querySelector(".arena");
  if (playerTeam === 2) {
    arena?.classList.add("arena--mirrored");
    document.body.classList.add("perspective-team2");
  } else {
    arena?.classList.remove("arena--mirrored");
    document.body.classList.remove("perspective-team2");
  }

  // rebuildReserveDisplay(1);
  // rebuildReserveDisplay(2);
});

socket.on("playerEmblemsUpdated", ({ emblems } = {}) => {
  const next = Array.isArray(emblems) ? emblems : [];
  playerEmblems = next.slice();
  selectedEmblemKeys = [...next];
  renderEmblemSelectionUI();
  renderPlayerEmblemStrip();
});

socket.on("waitingForOpponent", (message) => {
  loginMessage.textContent = message;
  joinArenaBtn.disabled = true;
  usernameInput.disabled = true;
});

socket.on("serverFull", (message) => {
  alert(message);
  socket.disconnect();
});

socket.on("allPlayersConnected", () => {
  // Transição: login → main content
  loginScreen.classList.remove("active");
  loginScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Attach listener for skipping slot (uses existing ref)
  if (skipSlotBtn) {
    skipSlotBtn.addEventListener("click", skipCurrentSlot);
  }

  // Reset selection state for new game
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }

  // Reset game flags
  gameEnded = false;
  window.gameEnded = false;

  // Reset surrender button
  if (surrenderBtn) surrenderBtn.disabled = false;
  closeSurrenderDialog();

  // Hide game over overlay
  gameOverOverlay.classList.remove(
    "active",
    "win-background",
    "lose-background",
  );
  gameOverOverlay.classList.add("hidden");

  const gameOverContent = gameOverOverlay.querySelector(".game-over-content");
  gameOverContent.classList.add("hidden");
  gameOverContent.classList.remove("win", "lose");

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  returnToLoginBtn.onclick = null;

  combatAnimations.reset();
});

socket.on("forceLogout", (message) => {
  alert(message);

  // Volta para a tela de login
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginScreen.classList.add("active");

  // Clear all game state
  activeChampions.clear();
  currentTurn = 1;
  playerId = null;
  playerTeam = null;
  username = null;
  playerNames.clear();

  // Remove perspective classes
  document.querySelector(".arena")?.classList.remove("arena--mirrored");
  document.body.classList.remove("perspective-team2");

  // Reset login elements
  usernameInput.value = "";
  usernameInput.disabled = false;
  joinArenaBtn.disabled = false;
  loginMessage.textContent = "Enter your username to play.";

  // Clear disconnection timers
  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
    disconnectionCountdownInterval = null;
  }
  disconnectionMessage.classList.remove("visible");
  disconnectionMessage.classList.add("hidden");
  disconnectionMessage.textContent = "";

  combatAnimations.reset();
});

// ============================================================
//  OPPONENT DISCONNECTION / RECONNECTION
// ============================================================

socket.on("opponentDisconnected", ({ timeout }) => {
  let timeLeft = timeout / 1000;
  disconnectionMessage.textContent = `Opponent disconnected. Returning to login in ${timeLeft} seconds if not reconnected.`;
  disconnectionMessage.classList.remove("hidden");
  disconnectionMessage.classList.add("visible");

  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
  }

  disconnectionCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(disconnectionCountdownInterval);
      disconnectionMessage.textContent = "";
      disconnectionMessage.classList.remove("visible");
      disconnectionMessage.classList.add("hidden");
    } else {
      disconnectionMessage.textContent = `Opponent disconnected. Returning to login in ${timeLeft} seconds if not reconnected.`;
    }
  }, 1000);
});

socket.on("opponentReconnected", () => {
  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
    disconnectionCountdownInterval = null;
  }
  disconnectionMessage.textContent = "Opponent reconnected!";
  setTimeout(() => {
    disconnectionMessage.classList.remove("visible");
    disconnectionMessage.classList.add("hidden");
    disconnectionMessage.textContent = "";
  }, 3000);
});

// ============================================================
//  CONFIRMATION ON TAB CLOSE/RELOAD
// ============================================================

window.addEventListener("beforeunload", function (e) {
  // Only show the warning if the user is logged in and not on the login screen
  if (
    playerId !== null &&
    playerTeam !== null &&
    !loginScreen.classList.contains("active") &&
    !gameEnded
  ) {
    const confirmationMessage =
      "Are you sure you want to leave? You may lose your progress in the match.";
    (e || window.event).returnValue = confirmationMessage; // Para navegadores antigos
    return confirmationMessage; // Para navegadores modernos
  }
});

// ============================================================
//  PLAYERS NAMES & SCOREBOARD
// ============================================================

// ============================================================
//  CHAMPION SELECTION
// ============================================================

socket.on("startChampionSelection", ({ timeLeft }) => {
  championSelectionScreen.classList.remove("hidden");
  championSelectionScreen.classList.add("active");
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");

  renderAvailableChampions();

  championSelectionTimeLeft = timeLeft;
  updateChampionSelectionTimerUI();

  if (championSelectionTimer) clearInterval(championSelectionTimer);

  championSelectionTimer = setInterval(() => {
    championSelectionTimeLeft--;
    updateChampionSelectionTimerUI();
    if (championSelectionTimeLeft <= 0) {
      clearInterval(championSelectionTimer);
      if (!playerTeamConfirmed) {
        // Time's up — send the current selection; server fills in the missing ones
        // keep a local copy of the roster for lineup UI
        playerRoster = selectedChampions.slice();
        renderLineupBanner();
        socket.emit("selectTeam", {
          team: playerTeam,
          champions: selectedChampions,
        });
        teamSelectionMessage.textContent =
          "Time's up! Team sent. Waiting for the other player...";
        playerTeamConfirmed = true;
        confirmTeamBtn.disabled = true;
      }
    }
  }, 1000);
});

socket.on("allTeamsSelected", () => {
  championSelectionScreen.classList.remove("active");
  championSelectionScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Play main soundtrack playlist (alternates between tracks)
  // Repeat main2 twice because it's shorter than main
  audioManager.playMusic(["main", "main2", "main2"]);

  // Reset selection state
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  resetLineupMaterializationState();
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }
});

confirmTeamBtn.addEventListener("click", () => {
  if (playerTeamConfirmed) return;
  if (selectedChampions.includes(null)) {
    alert("Please select your champions for the team.");
    return;
  }
  playerTeamConfirmed = true;
  confirmTeamBtn.disabled = true;
  // keep a local copy of the roster for lineup UI
  playerRoster = selectedChampions.slice();
  renderLineupBanner();
  socket.emit("selectTeam", { team: playerTeam, champions: selectedChampions });
  teamSelectionMessage.textContent =
    "Team confirmed! Waiting for the other player...";
  clearInterval(championSelectionTimer);
});

// --- CHAMPION GRID RENDERING ---

// Function to sort champions alphabetically
function sortChampionKeysAlphabetically(keys) {
  return keys.sort((a, b) => {
    const nameA = championDB[a]?.name?.toLowerCase() || "";
    const nameB = championDB[b]?.name?.toLowerCase() || "";
    return nameA.localeCompare(nameB);
  });
}

const affinityBadgeByKey = Object.freeze({
  fire: "🔥",
  water: "🌊",
  lightning: "⚡",
  earth: "🌱",
  ice: "❄️",
  steel: "🛡️",
});

const championClassConfig = Object.freeze({
  assassin: { label: "Assassin", icon: "🗡" },
  mage: { label: "Mage", icon: "✦" },
  enchanter: { label: "Enchanter", icon: "✧" },
  brawler: { label: "Brawler", icon: "🥊" },
  tank: { label: "Tank", icon: "🛡" },
  marksman: { label: "Marksman", icon: "🏹" },
});

function toReadableLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeChampionClassKey(champion) {
  if (typeof champion.classKey === "string") {
    const normalized = champion.classKey.trim().toLowerCase();
    if (championClassConfig[normalized]) return normalized;
  }

  if (typeof champion.classTag === "string") {
    const normalized = champion.classTag
      .replace(/^class\s*:\s*/i, "")
      .trim()
      .toLowerCase();
    if (championClassConfig[normalized]) return normalized;
  }

  return null;
}

function getChampionSpecies(champion) {
  if (Array.isArray(champion.species)) {
    return champion.species
      .map((item) => String(item || "").trim())
      .filter(Boolean);
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
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    : typeof champion.elementalAffinities === "string"
      ? [champion.elementalAffinities.trim().toLowerCase()].filter(Boolean)
      : [];
  const classKey = normalizeChampionClassKey(champion);
  const classInfo = classKey ? championClassConfig[classKey] : null;

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

function renderChampionIdentityBadgesMarkup(champion) {
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

function renderChampionCardContent(champion) {
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

function getPlayerRosterForEmblemEligibility() {
  if (selectedChampions.some(Boolean)) {
    return selectedChampions.filter(Boolean);
  }

  return (playerRoster || []).filter(Boolean);
}

function getEmblemShortCode(emblem) {
  if (!emblem?.name) return "EM";

  const realName = emblem.name.replace(/^Emblem of(?: the)?\s+/i, "").trim();

  if (!realName) return "EM";

  const words = realName.split(/\s+/).filter(Boolean).slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase() || "").join("") || "EM";
}

function getEmblemRequirementLabel(requirement) {
  if (!requirement || typeof requirement !== "object") return "Disponível";

  if (requirement.elementalAffinity) {
    const { element, count } = requirement.elementalAffinity;
    return `${toReadableLabel(element)} x${count}`;
  }

  if (requirement.species) {
    const speciesValue =
      requirement.species.value ??
      requirement.species.species ??
      requirement.species.key ??
      "";
    return `${toReadableLabel(speciesValue)} x${requirement.species.count ?? 1}`;
  }

  if (requirement.classKey) {
    const classValue =
      requirement.classKey.value ??
      requirement.classKey.class ??
      requirement.classKey.key ??
      "";
    return `${toReadableLabel(classValue)} x${requirement.classKey.count ?? 1}`;
  }

  if (requirement.baseStat) {
    const statKey =
      requirement.baseStat.stat ??
      requirement.baseStat.key ??
      requirement.baseStat.name ??
      "Status";
    const targetValue =
      requirement.baseStat.min ??
      requirement.baseStat.value ??
      requirement.baseStat.threshold ??
      "";
    return `${toReadableLabel(statKey)} ${targetValue ? `≥ ${targetValue}` : ""} x${requirement.baseStat.count ?? 1}`.trim();
  }

  return "Disponível";
}

function evaluateEmblemRequirements(emblem, rosterKeys = []) {
  const requirements = emblem?.requirements ?? {};

  const requirementChecks = [];
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const addCheck = ({ label, actual, required }) => {
    requirementChecks.push({
      label,
      actual,
      required,
      pass: actual >= required,
    });
  };

  if (requirements.elementalAffinity) {
    const targetElement = String(requirements.elementalAffinity.element || "")
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.elementalAffinity.count || 0);
    const actualCount = roster.filter((champion) => {
      const affinities = Array.isArray(champion.elementalAffinities)
        ? champion.elementalAffinities
        : typeof champion.elementalAffinities === "string"
          ? [champion.elementalAffinities]
          : [];
      return affinities.some(
        (affinity) => String(affinity).trim().toLowerCase() === targetElement,
      );
    }).length;
    addCheck({
      label: `${toReadableLabel(targetElement)} affinity`,
      actual: actualCount,
      required: requiredCount,
    });
  }

  if (requirements.species) {
    const targetSpecies = String(
      requirements.species.value ??
        requirements.species.species ??
        requirements.species.key ??
        "",
    )
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.species.count || 0);
    const actualCount = roster.filter((champion) => {
      const species = getChampionSpecies(champion).map((entry) =>
        String(entry).trim().toLowerCase(),
      );
      return species.includes(targetSpecies);
    }).length;
    addCheck({
      label: `${toReadableLabel(targetSpecies)} species`,
      actual: actualCount,
      required: requiredCount,
    });
  }

  if (requirements.classKey) {
    const targetClass = String(
      requirements.classKey.value ??
        requirements.classKey.class ??
        requirements.classKey.key ??
        "",
    )
      .trim()
      .toLowerCase();
    const requiredCount = Number(requirements.classKey.count || 0);
    const actualCount = roster.filter((champion) => {
      const classKey = normalizeChampionClassKey(champion);
      return classKey === targetClass;
    }).length;
    addCheck({
      label: `${toReadableLabel(targetClass)} class`,
      actual: actualCount,
      required: requiredCount,
    });
  }

  if (requirements.baseStat) {
    const statKey = String(
      requirements.baseStat.stat ??
        requirements.baseStat.key ??
        requirements.baseStat.name ??
        "",
    ).trim();
    const requiredCount = Number(requirements.baseStat.count || 0);
    const threshold =
      requirements.baseStat.min ??
      requirements.baseStat.value ??
      requirements.baseStat.threshold;
    const actualCount = roster.filter((champion) => {
      const value = Number(champion[statKey]);
      if (!Number.isFinite(value)) return false;
      if (threshold == null) return true;
      return value >= Number(threshold);
    }).length;
    addCheck({
      label: `${toReadableLabel(statKey)} ≥ ${threshold ?? ""}`.trim(),
      actual: actualCount,
      required: requiredCount,
    });
  }

  const allMet =
    requirementChecks.length === 0 ||
    requirementChecks.every((check) => check.pass);

  return {
    allMet,
    checks: requirementChecks,
    summary: requirementChecks.length
      ? requirementChecks
          .map((check) => `${check.label}: ${check.actual}/${check.required}`)
          .join(" • ")
      : "Sem requisitos",
  };
}

function renderEmblemSelectionUI() {
  if (!emblemSelectionList) return;

  const rosterKeys = getPlayerRosterForEmblemEligibility();
  const eligibleKeys = new Set();

  emblemSelectionList.innerHTML = "";

  EMBLEMS.forEach((emblem) => {
    const isSelected = selectedEmblemKeys.includes(emblem.key);
    const requirementStatus = evaluateEmblemRequirements(emblem, rosterKeys);
    const isLocked =
      !isSelected && selectedEmblemKeys.length >= EMBLEM_MAX_SELECTION;
    const isBlocked = !requirementStatus.allMet && !isSelected;
    if (requirementStatus.allMet) eligibleKeys.add(emblem.key);

    const item = document.createElement("button");
    item.type = "button";
    item.className = `emblem-option ${isSelected ? "selected" : ""} ${requirementStatus.allMet ? "eligible" : "blocked"}`;
    item.disabled = isLocked || isBlocked;
    item.dataset.emblemKey = emblem.key;
    item.innerHTML = `
      <span class="emblem-option-badge">${escapeHtml(getEmblemShortCode(emblem))}</span>
      <span class="emblem-option-copy">
        <strong>${escapeHtml(emblem.name || emblem.key)}</strong>
        <small>${escapeHtml(getEmblemRequirementLabel(emblem.requirements))}</small>
      </span>
      <span class="emblem-option-state">${isSelected ? "ON" : requirementStatus.allMet ? "OK" : "REQ"}</span>
    `;

    item.addEventListener("click", () => {
      const current = [...selectedEmblemKeys];
      const existingIndex = current.indexOf(emblem.key);

      if (existingIndex >= 0) {
        current.splice(existingIndex, 1);
      } else if (current.length < EMBLEM_MAX_SELECTION) {
        current.push(emblem.key);
      } else {
        return;
      }

      selectedEmblemKeys = current;
      playerEmblems = [...selectedEmblemKeys];
      socket.emit("updatePlayerEmblems", {
        emblems: selectedEmblemKeys,
        draftRoster: getPlayerRosterForEmblemEligibility(),
      });
      renderEmblemSelectionUI();
      renderPlayerEmblemStrip();
    });

    item.addEventListener("mouseenter", () => {
      showEmblemTooltip(item, emblem, requirementStatus);
    });
    item.addEventListener("mouseleave", hideEmblemTooltip);
    item.addEventListener("focus", () => {
      showEmblemTooltip(item, emblem, requirementStatus);
    });
    item.addEventListener("blur", hideEmblemTooltip);

    emblemSelectionList.appendChild(item);
  });

  if (selectedEmblemsCount) {
    selectedEmblemsCount.textContent = String(selectedEmblemKeys.length);
  }
}

function showEmblemTooltip(
  target,
  emblem,
  requirementStatus = { summary: "Disponível" },
) {
  hideEmblemTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "emblem-tooltip";
  tooltip.innerHTML = `
    <div class="emblem-tooltip-title">${escapeHtml(emblem.name || emblem.key)}</div>
    <div class="emblem-tooltip-copy">${escapeHtml(typeof emblem.description === "function" ? emblem.description() : emblem.description || "")}</div>
    <div class="emblem-tooltip-meta">
      <span class="emblem-tooltip-meta-label">Requisitos</span>
      <strong>${escapeHtml(requirementStatus.summary || "Sem requisitos")}</strong>
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

function hideEmblemTooltip() {
  if (emblemTooltip) {
    emblemTooltip.remove();
    emblemTooltip = null;
  }
}

function renderPlayerEmblemStrip() {
  const strip = document.getElementById("playerLineupEmblems");
  if (!strip) return;

  const emblems = Array.isArray(playerEmblems) ? playerEmblems : [];
  if (!emblems.length) {
    strip.classList.add("hidden");
    strip.innerHTML = "";
    return;
  }

  strip.classList.remove("hidden");
  strip.innerHTML = emblems
    .map((emblemKey) => {
      const emblem = EMBLEMS.find((entry) => entry.key === emblemKey) || null;
      if (!emblem) return "";

      return `
        <button type="button" class="lineup-emblem-chip" data-emblem-key="${escapeHtml(emblem.key)}" title="${escapeHtml(emblem.name || emblem.key)}">
          <span class="lineup-emblem-chip-code">${escapeHtml(getEmblemShortCode(emblem))}</span>
        </button>
      `;
    })
    .join("");

  strip.querySelectorAll(".lineup-emblem-chip").forEach((button) => {
    const emblemKey = button.dataset.emblemKey;
    const emblem = EMBLEMS.find((entry) => entry.key === emblemKey);
    if (!emblem) return;

    const requirementStatus = evaluateEmblemRequirements(
      emblem,
      getPlayerRosterForEmblemEligibility(),
    );
    button.addEventListener("mouseenter", () =>
      showEmblemTooltip(button, emblem, requirementStatus),
    );
    button.addEventListener("mouseleave", hideEmblemTooltip);
    button.addEventListener("focus", () =>
      showEmblemTooltip(button, emblem, requirementStatus),
    );
    button.addEventListener("blur", hideEmblemTooltip);
  });
}

function renderLineupChipContent(champion, slotIndex) {
  if (!champion) {
    return `<span class="lineup-chip-slot-number">${slotIndex + 1}</span>`;
  }

  return `
    <span class="lineup-chip-inner">
      <img class="lineup-chip-portrait" src="${escapeHtml(champion.portrait || "/assets/portraits/placeholder.webp")}" alt="${escapeHtml(champion.name || "Campeão")}">
      <span class="lineup-chip-identity-row">
        ${renderChampionIdentityBadgesMarkup(champion)}
      </span>
    </span>
  `;
}

function attachChampionCardInteractions(card, championKey, fromSlotIndex = -1) {
  card.title =
    "Tap no botao para species | long press ou clique direito para flip";

  const flipCard = () => {
    card.classList.toggle("is-flipped");
  };

  const flipButtons = card.querySelectorAll(".champion-card-flip-btn");
  flipButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      flipCard();
    });
  });

  let longPressTimer = null;
  let longPressTriggered = false;
  let touchStartX = 0;
  let touchStartY = 0;
  const LONG_PRESS_MS = 450;
  const MAX_TOUCH_MOVE_PX = 14;

  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  card.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    if (event.target.closest(".champion-card-flip-btn")) return;

    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    longPressTriggered = false;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      flipCard();
    }, LONG_PRESS_MS);
  });

  card.addEventListener("touchmove", (event) => {
    if (!longPressTimer || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    if (deltaX > MAX_TOUCH_MOVE_PX || deltaY > MAX_TOUCH_MOVE_PX) {
      clearLongPressTimer();
    }
  });

  card.addEventListener("touchend", clearLongPressTimer);
  card.addEventListener("touchcancel", clearLongPressTimer);

  card.addEventListener("click", (event) => {
    if (event.target.closest(".champion-card-flip-btn")) return;
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }
    if (card.classList.contains("is-flipped")) {
      card.classList.remove("is-flipped");
      return;
    }
    handleChampionCardClick(championKey);
  });

  card.addEventListener("dragstart", (event) =>
    handleDragStart(event, championKey, fromSlotIndex),
  );
  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    card.classList.toggle("is-flipped");
  });
}

function renderAvailableChampions() {
  availableChampionsGrid.innerHTML = "";

  // Filter valid champions
  let allAvailableChampionKeys = Object.keys(championDB).filter((key) => {
    const champion = championDB[key];
    const isChampion = (champion.entityType ?? "champion") === "champion";
    const isSelectable = champion.selectable !== false;
    const isunavailable = champion.unreleased || champion.disabled;
    if (!isChampion) return false;
    if (!isSelectable) return false;
    if (isunavailable && !editMode.unavailableChampions) return false;
    return true;
  });

  // Sort alphabetically
  allAvailableChampionKeys = sortChampionKeysAlphabetically(
    allAvailableChampionKeys,
  );

  allAvailableChampionKeys.forEach((key) => {
    const champion = championDB[key];
    const card = document.createElement("div");
    card.classList.add("champion-card");
    card.dataset.championKey = key;
    card.draggable = true;

    card.innerHTML = renderChampionCardContent(champion);
    attachChampionCardInteractions(card, key, -1);

    availableChampionsGrid.appendChild(card);
  });

  updateSelectedChampionsUI();
}

// --- Click on champion card ---

function getDraftSelectableChampionKeys(excludeKeys = []) {
  return Object.keys(championDB).filter((key) => {
    const champion = championDB[key];
    if (!champion || (champion.entityType ?? "champion") !== "champion") {
      return false;
    }
    if (champion.selectable === false) return false;
    if (excludeKeys.includes(key)) return false;
    if (
      (champion.unreleased === true || champion.disabled === true) &&
      !editMode.unavailableChampions
    ) {
      return false;
    }
    return true;
  });
}

function getRandomChampionKeyForDraft(excludeKeys = []) {
  const availableKeys = getDraftSelectableChampionKeys(excludeKeys);
  if (availableKeys.length === 0) return null;
  return availableKeys[Math.floor(Math.random() * availableKeys.length)];
}

function autofillSelectedChampions() {
  if (playerTeamConfirmed) return;

  const nextSelection = selectedChampions.slice();
  const hasAnySelection = nextSelection.some(Boolean);

  if (!hasAnySelection) {
    for (let index = 0; index < TEAM_SIZE; index += 1) {
      const championKey = getRandomChampionKeyForDraft(nextSelection);
      if (!championKey) break;
      nextSelection[index] = championKey;
    }
  } else {
    for (let index = 0; index < nextSelection.length; index += 1) {
      if (nextSelection[index] !== null) continue;

      const championKey = getRandomChampionKeyForDraft(nextSelection);
      if (!championKey) break;
      nextSelection[index] = championKey;
    }
  }

  selectedChampions = nextSelection;
  updateSelectedChampionsUI();
  teamSelectionMessage.textContent =
    "Empty slots automatically filled with random champions.";
}

function handleChampionCardClick(championKey) {
  if (playerTeamConfirmed) return;

  const index = selectedChampions.indexOf(championKey);
  if (index > -1) {
    selectedChampions[index] = null;
  } else {
    const emptySlotIndex = selectedChampions.indexOf(null);
    if (emptySlotIndex > -1) {
      selectedChampions[emptySlotIndex] = championKey;
    } else {
      alert("All slots are filled. Remove one to add another.");
    }
  }
  updateSelectedChampionsUI();
  renderEmblemSelectionUI();
}

// --- Update selected champions slots UI ---

function updateSelectedChampionsUI() {
  selectedChampionsSlots.innerHTML = "";
  let allSlotsFilled = true;

  selectedChampions.forEach((championKey, index) => {
    const slot = document.createElement("div");
    slot.classList.add("champion-slot");
    slot.dataset.slotIndex = index;
    slot.addEventListener("dragover", handleDragOver);
    slot.addEventListener("drop", handleDrop);
    slot.addEventListener("dragleave", handleDragLeave);

    if (championKey) {
      const champion = championDB[championKey];
      slot.classList.add("has-champion");
      const card = document.createElement("div");
      card.classList.add("champion-card");
      card.dataset.championKey = championKey;
      card.draggable = true;
      card.innerHTML = renderChampionCardContent(champion);
      attachChampionCardInteractions(card, championKey, index);
      slot.appendChild(card);
    } else {
      allSlotsFilled = false;
      slot.textContent = `Slot ${index + 1}`;
    }

    selectedChampionsSlots.appendChild(slot);
  });

  // Mark the cards in the available grid as selected
  document
    .querySelectorAll(".available-champions-grid .champion-card")
    .forEach((card) => {
      const key = card.dataset.championKey;
      card.classList.toggle("selected", selectedChampions.includes(key));
    });

  autofillTeamBtn.disabled =
    playerTeamConfirmed ||
    !selectedChampions.includes(null) ||
    getDraftSelectableChampionKeys(selectedChampions).length === 0;
  confirmTeamBtn.disabled = !allSlotsFilled || playerTeamConfirmed;

  renderEmblemSelectionUI();
  renderPlayerEmblemStrip();
}

autofillTeamBtn.addEventListener("click", autofillSelectedChampions);

// --- Drag & Drop ---

// --- Lineup banner & initial 1v1 selection UI ---
let playerRoster = Array(TEAM_SIZE).fill(null); // copy of the player's confirmed roster
let firstChoicePending = false;
let firstChoiceSelected = null;
let firstChoiceResolved = false; // true once the first champion has been decided; chips stop opening the 1v1 overlay
const materializedLineupChampions = new Set();

// --- Manual mid-match summon from lineup ---
// Eligibility (slot free, once per turn) is server-authoritative; this only
// tracks a request in flight so we don't double-submit while awaiting a reply.
let pendingSummonChampionKey = null;

const lineupBanner =
  document.getElementById("playerLineupBanner") ||
  document.getElementById("lineupBanner");
const lineupChips =
  document.getElementById("playerLineupChips") ||
  document.getElementById("lineupChips");
const firstChoiceOverlay = document.getElementById("firstChoiceOverlay");
const firstChoiceChips = document.getElementById("firstChoiceChips");
const firstChoiceCancel = document.getElementById("firstChoiceCancel");

function renderLineupBanner() {
  if (!lineupBanner || !lineupChips) return;
  lineupChips.innerHTML = "";
  let hasAny = false;
  (playerRoster || []).forEach((champKey, idx) => {
    const chip = document.createElement("div");
    chip.className = "lineup-chip";
    chip.dataset.index = idx;
    chip.dataset.championKey = champKey || "";
    chip.title = champKey
      ? championDB[champKey]?.name || champKey
      : `Slot ${idx + 1}`;
    chip.classList.toggle(
      "selected",
      !!champKey && champKey === firstChoiceSelected,
    );
    chip.classList.toggle(
      "materialized",
      !!champKey &&
        playerTeam !== null &&
        materializedLineupChampions.has(`${playerTeam}:${champKey}`),
    );
    chip.classList.toggle(
      "summon-locked",
      firstChoiceResolved &&
        !!champKey &&
        !chip.classList.contains("materialized") &&
        pendingSummonChampionKey === champKey,
    );

    if (champKey && championDB[champKey]) {
      chip.innerHTML = renderLineupChipContent(championDB[champKey], idx);
      hasAny = true;
    } else {
      chip.innerHTML = renderLineupChipContent(null, idx);
    }

    // Before the first choice is resolved: chip opens the 1v1 overlay/selection.
    // After it's resolved: chip lets the player manually summon that champion (once per turn).
    chip.setAttribute("role", "button");
    if (!firstChoiceResolved) {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!firstChoicePending) {
          // quick open full overlay
          openFirstChoiceOverlay();
          return;
        }
        const key = chip.dataset.championKey;
        if (!key) return;
        chooseFirstChampion(key);
      });
    } else {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        requestSummonFromLineup(chip);
      });
    }

    lineupChips.appendChild(chip);
  });

  lineupBanner.classList.toggle("hidden", !hasAny);
}

/** Handles a click on a lineup chip after the 1v1 first-choice phase, to manually summon that champion. */
/** Eligibility is decided by the server; this only guards against double-submitting the same request. */
function requestSummonFromLineup(chip) {
  const championKey = chip.dataset.championKey;
  if (!championKey) return;

  if (chip.classList.contains("materialized")) {
    logCombat("This champion has already been summoned this match.");
    return;
  }
  if (pendingSummonChampionKey) return;

  pendingSummonChampionKey = championKey;
  socket.emit("summonFromLineup", { championKey });
}

function openFirstChoiceOverlay() {
  if (!firstChoiceOverlay) return;
  firstChoiceOverlay.classList.remove("hidden");
  firstChoiceOverlay.focus?.();
  // render chips
  firstChoiceChips.innerHTML = "";
  (playerRoster || []).forEach((champKey, idx) => {
    const chip = document.createElement("div");
    chip.className = "lineup-chip";
    chip.dataset.index = idx;
    chip.dataset.championKey = champKey || "";
    chip.title = champKey
      ? championDB[champKey]?.name || champKey
      : `Slot ${idx + 1}`;

    chip.innerHTML = renderLineupChipContent(
      champKey && championDB[champKey] ? championDB[champKey] : null,
      idx,
    );

    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = chip.dataset.championKey;
      if (!key) return;
      chooseFirstChampion(key);
    });

    firstChoiceChips.appendChild(chip);
  });
}

function closeFirstChoiceOverlay() {
  if (!firstChoiceOverlay) return;
  firstChoiceOverlay.classList.add("hidden");
}

function chooseFirstChampion(championKey) {
  if (!firstChoicePending) return;
  if (!championKey) return;
  socket.emit("chooseFirstChampion", { championKey });
  firstChoiceSelected = championKey;
  firstChoicePending = false; // disable further picks locally until server ack
  // show waiting state
  firstChoiceChips.innerHTML = `<div style="color:#e6fff2;">Waiting for opponent...</div>`;
  // highlight chosen chip in banner
  Array.from(lineupChips.children).forEach((c) => {
    c.classList.toggle("selected", c.dataset.championKey === championKey);
  });
}

function syncMaterializedLineupChampions(gameStateChampions = []) {
  gameStateChampions.forEach((champion) => {
    if (!champion?.championKey || champion.team == null) return;
    materializedLineupChampions.add(`${champion.team}:${champion.championKey}`);
  });

  if (!lineupChips || playerTeam === null) return;

  Array.from(lineupChips.children).forEach((chip) => {
    const championKey = chip.dataset.championKey;
    if (!championKey) return;
    chip.classList.toggle(
      "materialized",
      materializedLineupChampions.has(`${playerTeam}:${championKey}`),
    );
  });
}

function resetLineupMaterializationState() {
  materializedLineupChampions.clear();
  if (!lineupChips) return;
  Array.from(lineupChips.children).forEach((chip) => {
    chip.classList.remove("materialized");
  });
}

firstChoiceCancel?.addEventListener("click", () => {
  closeFirstChoiceOverlay();
});

// Socket events for first-choice flow
socket.on("requestFirstChampionSelection", ({ roster, team }) => {
  // roster: array of championKeys
  if (Array.isArray(roster)) playerRoster = roster.slice(0, TEAM_SIZE);
  resetLineupMaterializationState();
  firstChoicePending = true;
  firstChoiceSelected = null;
  firstChoiceResolved = false;
  renderLineupBanner();
  openFirstChoiceOverlay();
});

socket.on("firstChampionChosenAck", ({ championKey }) => {
  // mark chosen locally; UI already updated when emitting
  // keep overlay visible showing waiting state
});

socket.on("firstChampionChoicesFinalized", ({ firstChampions }) => {
  // firstChampions: [team1Key, team2Key]
  firstChoicePending = false;
  firstChoiceResolved = true;
  closeFirstChoiceOverlay();
  // rebuild banner read-only, without the click listener that opens the overlay
  renderLineupBanner();
});

function handleDragStart(e, championKey, fromSlotIndex = -1) {
  if (playerTeamConfirmed) {
    e.preventDefault();
    return;
  }
  draggedChampionKey = championKey;
  draggedFromSlotIndex = fromSlotIndex;
  e.dataTransfer.setData("text/plain", championKey);
  e.currentTarget.classList.add("dragging");
}

function handleDragOver(e) {
  e.preventDefault();
  if (playerTeamConfirmed) return;
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  if (playerTeamConfirmed) return;
  e.currentTarget.classList.remove("drag-over");

  const droppedChampionKey = e.dataTransfer.getData("text/plain");
  const targetSlotIndex = parseInt(e.currentTarget.dataset.slotIndex);
  if (isNaN(targetSlotIndex)) return;

  if (selectedChampions[targetSlotIndex] === null) {
    // Dropping in empty slot
    if (draggedFromSlotIndex === -1) {
      selectedChampions[targetSlotIndex] = droppedChampionKey;
    } else {
      selectedChampions[targetSlotIndex] = droppedChampionKey;
      selectedChampions[draggedFromSlotIndex] = null;
    }
  } else {
    // Dropping in occupied slot — swap
    const temp = selectedChampions[targetSlotIndex];
    selectedChampions[targetSlotIndex] = droppedChampionKey;
    if (draggedFromSlotIndex !== -1) {
      selectedChampions[draggedFromSlotIndex] = temp;
    } else {
      const oldChampionIndex = selectedChampions.indexOf(droppedChampionKey);
      if (oldChampionIndex > -1) {
        selectedChampions[oldChampionIndex] = null;
      }
    }
  }

  document
    .querySelector(".champion-card.dragging")
    ?.classList.remove("dragging");
  draggedChampionKey = null;
  draggedFromSlotIndex = -1;
  updateSelectedChampionsUI();
}

// --- Selection timer ---

function updateChampionSelectionTimerUI() {
  const minutes = Math.floor(championSelectionTimeLeft / 60);
  const seconds = championSelectionTimeLeft % 60;
  teamSelectionMessage.textContent = `Time remaining to select champions: ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  if (playerTeamConfirmed) {
    teamSelectionMessage.textContent += " (Team confirmed!)";
  }
}

// ============================================================
//  GERENCIAMENTO DE CAMPEÕES
// ============================================================

socket.on("championRemoved", (championId) => {
  combatAnimations.handleChampionRemoved(championId);
  // After removal, re-sort DOM to match logical slot order
  sortTeamContainersByCombatSlot();
});

/** Creates and renders a new champion on the battlefield. */
function createNewChampion(championData) {
  const baseData = championDB[championData.championKey];
  if (!baseData) throw new Error("Invalid champion");

  const champion = Champion.fromBaseData(
    baseData,
    championData.id,
    championData.team,
    { combatSlot: championData.combatSlot ?? null },
  );
  champion.championKey = championData.championKey;
  champion.baseAttack = baseData.Attack;
  champion.baseDefense = baseData.Defense;
  champion.baseSpeed = baseData.Speed;
  champion.baseCritical = baseData.Critical;
  champion.baseLifeSteal = baseData.LifeSteal;

  activeChampions.set(champion.id, champion);

  const teamContainer = document.querySelector(`.team-${champion.team}`);
  champion.render(teamContainer, {
    onSkillClick: handleSkillUsage,
    onDelete: deleteChampion,
    onPortraitClick: openChampionOverlay,
    // Adds hover/touch overlay on the portrait
    onPortraitHover: (champ) => showQuickStatsOverlay(champ),
    onPortraitHoverOut: hideQuickStatsOverlay,
    // Adds hover/touch overlay on the skills
    showSkillOverlay: showSkillOverlay,
    removeSkillOverlay: removeSkillOverlay,
    editMode: editMode,
  });

  // Adds listeners for hover/touch on the portrait
  setTimeout(() => {
    const el = teamContainer.querySelector(
      `.champion[data-champion-id='${champion.id}'] .portrait`,
    );
    if (el) {
      // Desktop: hover
      el.addEventListener("mouseenter", (e) => {
        if (window.ontouchstart === undefined) showQuickStatsOverlay(champion);
      });
      el.addEventListener("mouseleave", (e) => {
        if (window.ontouchstart === undefined) hideQuickStatsOverlay();
      });
      // Mobile: touch
      el.addEventListener(
        "touchstart",
        (e) => {
          showQuickStatsOverlay(champion);
          e.stopPropagation();
        },
        { passive: true },
      );
      el.addEventListener(
        "touchend",
        (e) => {
          hideQuickStatsOverlay();
          e.stopPropagation();
        },
        { passive: true },
      );
    }
  }, 0);

  // After creation, re-sort DOM to match logical slot order
  // (in case of respawn or debug add)
  sortTeamContainersByCombatSlot();

  return champion;
}

// Ensures the DOM order of .champion elements in each .team-X container matches logical combatSlot order
function sortTeamContainersByCombatSlot() {
  // For each team present in the DOM
  const teamNumbers = new Set(
    Array.from(activeChampions.values()).map((c) => c.team),
  );
  for (const team of teamNumbers) {
    const teamContainer = document.querySelector(`.team-${team}`);
    if (!teamContainer) continue;
    // Get all champion elements in this container
    const championEls = Array.from(teamContainer.querySelectorAll(".champion"));
    // Map: championId -> element
    const elById = new Map(
      championEls.map((el) => [el.dataset.championId, el]),
    );
    // Get all active champions for this team, sorted by combatSlot
    const sorted = Array.from(activeChampions.values())
      .filter((c) => c.team === team)
      .sort((a, b) => (a.combatSlot ?? 0) - (b.combatSlot ?? 0));
    // Remove all .champion elements from container
    championEls.forEach((el) => teamContainer.removeChild(el));
    // Re-append in correct order
    for (const champ of sorted) {
      const el = elById.get(champ.id?.toString() || champ.id);
      if (el) teamContainer.appendChild(el);
    }
  }
}
/*   */
// Quick stats overlay (hover/touch on the portrait)
let quickStatsOverlay = null;

function showQuickStatsOverlay(champion) {
  hideQuickStatsOverlay();
  if (!champion) return;

  quickStatsOverlay = document.createElement("div");
  quickStatsOverlay.className = "quick-stats-overlay";
  quickStatsOverlay.style.position = "fixed";
  quickStatsOverlay.style.zIndex = 13000;
  quickStatsOverlay.style.pointerEvents = "none";

  const statRows = [];

  // HP (texto)
  statRows.push({
    label: "HP",
    value: `${champion.HP}/${champion.maxHP}`,
  });

  // Numéricos baseados em comparação
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

      if (row.percent) {
        displayValue = `${row.value}%`;
      }
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

/** Remove a champion from the local team (edit mode / debug). */
function deleteChampion(championId) {
  const champion = activeChampions.get(championId);
  if (!(champion instanceof Champion)) {
    console.error("Champion not found.");
    return;
  }
  if (champion.team !== playerTeam) {
    alert("You can only remove champions from your team.");
    return;
  }
  if (confirm("Are you sure you want to remove this champion?")) {
    socket.emit("removeChampion", { championId });
  }
}

// ============================================================
//  SKILL USAGE & TARGET SELECTION
// ============================================================

/** Extracts the context (champion + skill) from a skill button. */
function getSkillContext(button) {
  const userId = button.dataset.championId;
  const skillKey = button.dataset.skillKey;

  const user = activeChampions.get(userId);
  if (!user) return null;

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return null;

  return { user, skill, userId, skillKey };
}

/** Main handler: validates and requests skill usage from the server. */
async function handleSkillUsage(button) {
  if (window.gameEnded) {
    alert("The game has ended. No actions can be performed.");
    return;
  }

  if (button.disabled) return;

  const ctx = getSkillContext(button);
  if (!ctx) return;

  const { user, userId, skillKey, skill } = ctx;

  if (user.team !== playerTeam) {
    alert("You can only use skills of champions on your team.");
    return;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    alert(`${user.name} has already acted this turn.`);
    return;
  }

  const cost = user.getSkillCost(skill);

  console.log(
    "CLIENT CHECK: ",
    user.name,
    "trying to use",
    skill.name,
    `(Cost: ${cost}, Momentum: ${user.momentum})`,
  );

  if (!editMode.freeCostSkills && cost > user.momentum) {
    alert(`Not enough Momentum.`);
    user.updateUI(currentTurn);
    return;
  }

  // Requests authorization from the server before resolving targets
  socket.emit("requestSkillUse", { userId, skillKey });
}

socket.on("skillDenied", (message) => {
  console.warn("[SkillDenied]", message);
  alert(message);
});

socket.on("skillApproved", async ({ userId, skillKey }) => {
  console.log(
    `[SkillApproved] Resolving targets for ${userId} using ${skillKey}`,
  );
  const user = activeChampions.get(userId);
  if (!user) return;

  if (skillKey === CLAIM_ACTION_KEY) {
    if (!editMode.actMultipleTimesPerTurn) {
      user.markActionTaken();
      user.updateUI(currentTurn);
    }

    socket.emit("useSkill", { userId, skillKey, targetIds: {} });
    document.getElementById("undo-actions-btn").disabled = false;

    if (!editMode.actMultipleTimesPerTurn) {
      advanceActionBarSlot(userId);
    }

    return;
  }

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return;

  // Collects targets on the client
  const targets = await collectClientTargets(user, skill);
  console.log("[SkillApproved] Collected targets:", targets);
  if (!targets) return;

  const targetIds = {};
  for (const role in targets) {
    targetIds[role] = targets[role].id;
  }

  // Marks the action only after resolving targets
  if (!editMode.actMultipleTimesPerTurn) {
    user.markActionTaken();
    user.updateUI(currentTurn);
  }

  socket.emit("useSkill", { userId, skillKey, targetIds });
  // Enables undo immediately after queuing the action
  document.getElementById("undo-actions-btn").disabled = false;
  if (!editMode.actMultipleTimesPerTurn) {
    advanceActionBarSlot(userId);
  }
});

// --- Collects targets on the client ---

async function collectClientTargets(user, skill) {
  if (!skill || !Array.isArray(skill.targetSpec)) return null;

  const normalizedSpec = skill.targetSpec.map((s) =>
    typeof s === "string" ? { type: s } : s,
  );

  const hasGlobal = normalizedSpec.some(
    (s) => s.type === "all" || s.type === "all:enemy" || s.type === "all:ally",
  );

  // If it's a global skill, don't open the selection UI
  if (hasGlobal) {
    return {};
  }

  const championsInField = Array.from(activeChampions.values());

  const targets = {};
  const enemyCounter = { count: 0 };
  const chosenTargets = new Set();

  for (const spec of normalizedSpec) {
    const target = await selectTargetForRole(
      spec,
      user,
      championsInField,
      enemyCounter,
      chosenTargets,
      spec.unique === true,
    );

    console.log(`[collectClientTargets] Role: ${spec.type}, Target:`, target);

    // cancelamento manual
    if (target === null) return null;

    // slot ignorado
    if (target === undefined) continue;

    Object.assign(targets, target);
  }

  const hasTargets = Object.keys(targets).length > 0;

  if (!hasTargets) {
    alert("There are no valid targets for this skill.");
    return null;
  }

  return targets;
}

async function selectTargetForRole(
  spec,
  user,
  championsInField,
  enemyCounter,
  chosenTargets,
  enforceUnique,
) {
  // Helper: filters already chosen targets when uniqueness is enforced
  const filterUnique = (list) =>
    enforceUnique ? list.filter((c) => !chosenTargets.has(c.id)) : list;

  // Helper: sorts candidates to strictly match their visual order on the field (by combatSlot)
  const byFieldOrder = (list) =>
    [...list].sort((a, b) => (a.combatSlot ?? 0) - (b.combatSlot ?? 0));

  const role = spec.type;

  console.log(`[selectTargetForRole] Selecting target for role: ${role}`);

  // SELF (automatic)
  if (role === "self") {
    chosenTargets.add(user.id);
    return { self: user };
  }

  // ALLY (automatic — first available ally)
  if (role === "ally") {
    let allies = championsInField.filter(
      (c) => c.team === user.team && c.id !== user.id,
    );
    allies = byFieldOrder(filterUnique(allies));
    if (allies.length === 0) return undefined;
    chosenTargets.add(allies[0].id);
    return { ally: allies[0] };
  }

  // SELECT ALLY (manual selection)
  if (role === "select:ally") {
    let candidates = championsInField.filter((c) => c.team === user.team);

    if (spec.excludesSelf) {
      candidates = candidates.filter((c) => c.id !== user.id);
    }

    candidates = byFieldOrder(filterUnique(candidates));

    const target = await createTargetSelectionOverlay(
      candidates,
      "Choose an Ally",
    );

    if (target === null) return null;
    if (target === undefined) return undefined;

    chosenTargets.add(target.id);
    return { ally: target };
  }

  // ALLY/ENEMY GLOBAL (no selection, affects all champions of the type)
  if (role === "all:ally" || role === "all" || role === "all:enemy") return {};

  // ENEMY (manual selection)
  if (role === "enemy") {
    enemyCounter.count++;

    const index = enemyCounter.count;

    let candidates = championsInField.filter((c) => c.team !== user.team);
    candidates = byFieldOrder(filterUnique(candidates));

    const target = await createTargetSelectionOverlay(
      candidates,
      index === 1 ? "Select the ENEMY" : `Select the ENEMY ${index}`,
    );

    console.log(
      `[selectTargetForRole] Candidates for enemy ${index}:`,
      candidates,
    );

    if (target === null) return null;
    if (target === undefined) return undefined;

    chosenTargets.add(target.id);
    const key = index === 1 ? "enemy" : `enemy${index}`;
    console.log(
      `[selectTargetForRole] Selected target for ${key}:`,
      target,
      chosenTargets,
    );

    return { [key]: target };
  }

  console.error(`[selectTargetForRole] Unknown target role: ${role}`);
  return undefined;
}

// --- Overlay de seleção de alvo ---

function createTargetSelectionOverlay(candidates, title) {
  // Remove skill overlay if open (fixes mobile bug)
  removeSkillOverlay && removeSkillOverlay();
  return new Promise((resolve) => {
    // if there are no candidates, avoid opening the empty selection UI
    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log(
        `[createTargetSelectionOverlay] No candidates available for "${title}". Skipping selection. Resolving undefined.`,
      );
      resolve(undefined);
      return;
    }

    const overlay = document.createElement("div");
    overlay.classList.add("targetSelectionOverlay");

    const h2 = document.createElement("h2");
    h2.textContent = title;
    overlay.appendChild(h2);

    const container = document.createElement("div");
    container.classList.add("target-candidates");

    candidates.forEach((champion) => {
      const card = document.createElement("div");
      card.classList.add("target-candidate");
      card.innerHTML = `
        <img src="${champion.portrait}" alt="${champion.name}">
        <h3>${champion.name}</h3>
        <p>HP: ${champion.HP}/${champion.maxHP}</p>
      `;
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTargetOverlay(overlay);
        resolve(champion);
      });
      container.appendChild(card);
    });

    overlay.appendChild(container);

    // Click outside cancels the selection
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeTargetOverlay(overlay);
        resolve(null);
      }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("active"));
  });
}

function closeTargetOverlay(overlay) {
  overlay.classList.remove("active");
  setTimeout(() => overlay.remove(), 200);
}

// ============================================================
//  LINEUP BANNERS
// ============================================================
// Player's own banner stays owned by renderLineupBanner() (playerRoster-driven).
// This one only fills the opponent's read-only banner from server-authoritative rosters.

function renderLineupBanners(lineupsByTeam = {}) {
  const opponentBanner = document.getElementById("opponentLineupBanner");
  const opponentChipsContainer = document.getElementById("opponentLineupChips");
  if (!opponentBanner || !opponentChipsContainer || playerTeam === null) return;

  const enemyTeam = playerTeam === 1 ? 2 : 1;
  const enemyLineup = lineupsByTeam?.[enemyTeam] || [];

  if (enemyLineup.length === 0) {
    opponentBanner.classList.add("hidden");
    opponentBanner.setAttribute("aria-hidden", "true");
    return;
  }

  opponentBanner.classList.remove("hidden");
  opponentBanner.setAttribute("aria-hidden", "false");

  opponentChipsContainer.innerHTML = enemyLineup
    .map((champKey, idx) => {
      const champion = champKey ? championDB[champKey] : null;

      const isMaterialized =
        !!champKey &&
        materializedLineupChampions.has(`${enemyTeam}:${champKey}`);

      const chipClass = `lineup-chip${
        isMaterialized ? " materialized" : " unrevealed"
      }`;

      if (!isMaterialized) {
        return `
          <div
            class="${chipClass}"
            title="Champion not revealed"
            aria-label="Champion not revealed"
          >
            <span class="lineup-chip-unknown">?</span>
          </div>
        `;
      }

      const title = champion?.name || champKey;

      return `
        <div class="${chipClass}" title="${title}">
          ${renderLineupChipContent(champion, idx)}
        </div>
      `;
    })
    .join("");
}

// ============================================================
//  GERENCIAMENTO DE TURNOS
// ============================================================

socket.on("gameStateUpdate", (gameState) => {
  const serverEmblems = gameState?.playerEmblems?.[playerTeam] ?? [];
  if (
    playerTeam !== null &&
    Array.isArray(serverEmblems) &&
    serverEmblems.length
  ) {
    playerEmblems = serverEmblems.slice();
    selectedEmblemKeys = [...playerEmblems];
  }

  syncMaterializedLineupChampions(gameState?.champions || []);
  renderLineupBanners(gameState?.lineups);
  renderPlayerEmblemStrip();
  renderEmblemSelectionUI();
  combatAnimations.handleGameStateUpdate(gameState);

  if (
    pendingSummonChampionKey &&
    playerTeam !== null &&
    materializedLineupChampions.has(`${playerTeam}:${pendingSummonChampionKey}`)
  ) {
    pendingSummonChampionKey = null;
    renderLineupBanner();
  }
});

socket.on("scoreUpdate", (score) => {
  updateScoreDisplay(score);
});

socket.on("actionFailed", (message) => {
  console.warn("[ActionFailed]", message);
  pendingSummonChampionKey = null;
  combatAnimations.handleActionFailed(message);
});

socket.on("turnLocked", () => {
  document.getElementById("undo-actions-btn").disabled = true;
  hasConfirmedEndTurn = false;
  removeActionBar();
});

socket.on("turnUpdate", (turn) => {
  combatAnimations.handleTurnUpdate(turn);
});

socket.on("gameOver", (data) => {
  combatAnimations.handleGameOver(data);
  gameEnded = true;

  // Stop music when game is over
  if (audioManager.stopMusic) audioManager.stopMusic();

  removeActionBar();
});

socket.on("actionsCanceled", () => {
  document.getElementById("undo-actions-btn").disabled = true;

  hasConfirmedEndTurn = false;

  activeChampions.forEach((champion) => {
    champion.resetActionStatus();
    const context = {
      freeCostSkills: editMode?.freeCostSkills === true,
    };
    champion.updateUI(context);
  });

  if (playerTeam !== null) initActionBar();
});

/** Applies the turn transition on the client: resets actions and updates the UI. */
function applyTurnUpdate(turn) {
  currentTurn = turn;
  updateTurnDisplay(currentTurn);
  hasConfirmedEndTurn = false;
  pendingSummonChampionKey = null;
  renderLineupBanner();

  activeChampions.forEach((champion) => champion.resetActionStatus());

  activeChampions.forEach((champion) => {
    const context = {
      freeCostSkills: editMode?.freeCostSkills === true,
    };
    champion.updateUI(context);
    requestAnimationFrame(() => {
      (StatusIndicator.updateChampionIndicators(champion),
        syncChampionVFX(champion));
    });
  });

  // Initializes action selection by slot
  if (playerTeam !== null) initActionBar();

  logCombat(`Start of Turn ${currentTurn}`);
}

let turnTransitionTimer = null;
let turnTransitionSequence = 0;
let isFirstTurnUpdate = true;

function showTurnTransition(turn) {
  const overlay = document.getElementById("turnTransitionOverlay");
  const number = document.getElementById("turnTransitionNumber");

  if (!overlay || !number) return;

  const sequence = ++turnTransitionSequence;

  clearTimeout(turnTransitionTimer);

  const turnLabel = turn === 20 ? "LAST TURN" : `TURN ${turn}`;

  // Garante que o overlay comece mostrando o novo turno
  number.textContent = turnLabel;

  // Reset da animação do texto
  number.classList.remove("is-changing");

  // Força o browser a reconhecer o estado inicial
  void number.offsetWidth;

  // Entrada do overlay
  overlay.classList.add("is-visible");

  // Mantém o banner visível por um instante
  turnTransitionTimer = setTimeout(() => {
    if (sequence !== turnTransitionSequence) return;

    // Fade/blur do turno atual
    number.classList.add("is-changing");

    setTimeout(() => {
      if (sequence !== turnTransitionSequence) return;

      number.textContent = turnLabel;

      // Força reflow para reiniciar a entrada
      void number.offsetWidth;

      number.classList.remove("is-changing");

      // Depois de mostrar o novo turno, fecha o overlay
      turnTransitionTimer = setTimeout(() => {
        if (sequence !== turnTransitionSequence) return;

        overlay.classList.remove("is-visible");
      }, 700);
    }, 230);
  }, 700);
}

let lastDisplayedTurn = null;

function updateTurnDisplay(turn) {
  const turnDisplay = document.querySelector(".turn-display");
  const turnText = turnDisplay?.querySelector("p");

  if (turnText) {
    turnText.textContent = turn === 20 ? "Last Turn" : `Turn ${turn}`;
  }

  if (isFirstTurnUpdate) {
    isFirstTurnUpdate = false;
    lastDisplayedTurn = turn;
    return;
  }

  if (turn !== lastDisplayedTurn) {
    lastDisplayedTurn = turn;
    showTurnTransition(turn);
  }
}

function endTurn() {
  if (hasConfirmedEndTurn) {
    alert(
      "You have already confirmed the end of the turn. Waiting for the other player.",
    );
    return;
  }

  socket.emit("endTurn");
  hasConfirmedEndTurn = true;
  removeActionBar();
  logCombat(
    "You have confirmed the end of the turn. Waiting for the other player...",
  );

  document.getElementById("undo-actions-btn").disabled = false;
}

socket.on("playerConfirmedEndTurn", (playerSlot) => {
  const playerName = playerNames.get(playerSlot);
  if (playerSlot !== playerTeam - 1) {
    logCombat(
      `${playerName} confirmed the end of the turn. Waiting for your confirmation.`,
    );
  }
});

socket.on("waitingForOpponentEndTurn", (message) => {
  logCombat(message);
});

// ============================================================
//  LOG DE COMBATE
// ============================================================

socket.on("combatAction", (envelope) => {
  console.log("RECEBIDO NO CLIENT:", envelope);
  combatAnimations.handleCombatAction(envelope);
});

socket.on("combatPhaseComplete", () => {
  combatAnimations.handleCombatPhaseComplete();
});

socket.on("combatLog", (message) => {
  if (typeof message === "string") {
    combatAnimations.handleCombatLog(message);
  }
});

function logCombat(text) {
  if (typeof text !== "string" || !text) return;
  combatAnimations.handleCombatLog(text);
}

// ============================================================
//  EXIBIÇÃO DO CAMPEÃO DE RETAGUARDA (DESATIVADA)
// ============================================================

// const remainingSwitchesPerTeam = new Map([
//   [1, 0],
//   [2, 0],
// ]);

// socket.on("switchesUpdate", ({ team1, team2 }) => {
//   remainingSwitchesPerTeam.set(1, team1);
//   remainingSwitchesPerTeam.set(2, team2);
//   rebuildReserveDisplay(1);
//   rebuildReserveDisplay(2);
// });

// socket.on("backChampionUpdate", ({ team, queue }) => {
//   teamReserveQueue.set(team, queue ?? []);
//   rebuildReserveDisplay(team);
// });

// function getReserveDisplayElement(team) {
//   if (playerTeam === 1 || playerTeam === 2) {
//     return team === playerTeam
//       ? backChampionDisplayTeam1
//       : backChampionDisplayTeam2;
//   }
//
//   return team === 1 ? backChampionDisplayTeam1 : backChampionDisplayTeam2;
// }

function rebuildReserveDisplay(_team) {
  // Reserva/switch UI desativados.
}

// socket.on("championSwitchedOut", (championId) => {
//   combatAnimations.handleChampionSwitchedOut(championId);
// });

// socket.on("switchQueued", ({ championId }) => {
//   document.getElementById("undo-actions-btn").disabled = false;
//   advanceActionBarSlot(championId);
// });

// socket.on("switchDenied", (message) => {
//   alert(message);
// });

// ============================================================
//  ACTION BAR (slot-by-slot action selection)
// ============================================================

// Action bar state
let actionBarSlotOrder = []; // champion IDs for the player, sorted by combatSlot
let currentActionBarSlot = 0;
let actionBarEl = null; // reference to the .action-bar element in the DOM

function getActionBarChampion() {
  if (currentActionBarSlot >= actionBarSlotOrder.length) return null;
  return activeChampions.get(actionBarSlotOrder[currentActionBarSlot]) ?? null;
}

function isChampionAutoSkippedInActionBar(champion) {
  if (!champion || !champion.alive) return true;
  if (champion.actionBlockedByHardCC === true) return true;
  return champion.isActionBlockedByHardCC?.() === true;
}

function initActionBar() {
  removeActionBar();
  if (!playerTeam || window.gameEnded) return;

  actionBarSlotOrder = Array.from(activeChampions.values())
    .filter((c) => c.team === playerTeam)
    .sort((a, b) => (a.combatSlot ?? 0) - (b.combatSlot ?? 0))
    .map((c) => c.id);

  currentActionBarSlot = 0;
  showActionBarSlot();
}

function showActionBarSlot() {
  removeActionBar();
  if (currentActionBarSlot >= actionBarSlotOrder.length) {
    if (actionBarSlotOrder.length > 0) endTurn();
    return;
  }

  const champion = getActionBarChampion();
  if (!champion) return;

  if (isChampionAutoSkippedInActionBar(champion)) {
    currentActionBarSlot++;
    showActionBarSlot();
    return;
  }

  const teamContainer = document.querySelector(`.team-${playerTeam}`);
  if (!teamContainer) return;

  const slotNumber = currentActionBarSlot + 1;
  actionBarEl = document.createElement("div");
  actionBarEl.className = "action-bar";

  const header = document.createElement("div");
  header.className = "action-bar-header";
  header.textContent = `Escolha sua ação para o Slot ${slotNumber} (${champion.name})`;
  actionBarEl.appendChild(header);

  const skillsBar = document.createElement("div");
  skillsBar.className = "action-bar-skills";

  const claimSkill = {
    key: CLAIM_ACTION_KEY,
    name: "CLAIM",
  };

  const claimBtn = document.createElement("button");
  claimBtn.className = "action-bar-skill-btn claim";
  claimBtn.textContent = "CLAIM";
  claimBtn.title = "Marca pontos com base no seu Momentum atual.";

  claimBtn.addEventListener("mouseenter", () =>
    showSkillOverlay(claimBtn, claimSkill, champion),
  );

  claimBtn.addEventListener("mouseleave", () => removeSkillOverlay());

  claimBtn.addEventListener("click", () => handleClaimUsage(champion));

  if (!editMode.freeCostSkills && champion.momentum < CLAIM_MIN_MOMENTUM) {
    claimBtn.disabled = true;
  }
  skillsBar.appendChild(claimBtn);

  champion.skills.forEach((skill) => {
    const isUlt = skill.isUltimate === true;
    const label = isUlt ? `ULT — ${skill.name}` : skill.name;

    const btn = document.createElement("button");
    btn.className = "action-bar-skill-btn" + (isUlt ? " ultimate" : "");
    btn.dataset.championId = champion.id;
    btn.dataset.skillKey = skill.key;
    btn.textContent = label;

    btn.addEventListener("mouseenter", () =>
      showSkillOverlay(btn, skill, champion),
    );
    btn.addEventListener("mouseleave", () => removeSkillOverlay());
    btn.addEventListener("click", () => handleSkillUsage(btn));

    // Disable contact skill if champion is rooted
    const hasRooted =
      champion.statusEffects &&
      champion.statusEffects.has &&
      champion.statusEffects.has("rooted");
    if (skill.contact && hasRooted) {
      btn.disabled = true;
      btn.title = "Não pode usar habilidades de contato enquanto Enraizado.";
    }

    if (isUlt) {
      const cost = champion.getSkillCost(skill);
      const hasResource = editMode.freeCostSkills || champion.momentum >= cost;
      if (!hasResource) btn.disabled = true;
    }

    skillsBar.appendChild(btn);
  });

  actionBarEl.appendChild(skillsBar);
  teamContainer.appendChild(actionBarEl);

  if (skipSlotBtn) skipSlotBtn.disabled = false;

  // Update reserve display disabled.
  // rebuildReserveDisplay(playerTeam);
}

function advanceActionBarSlot(champId) {
  if (actionBarSlotOrder[currentActionBarSlot] === champId) {
    currentActionBarSlot++;
    showActionBarSlot();
    // Habilita o undo sempre que avança slot (há ação pendente)
    document.getElementById("undo-actions-btn").disabled = false;
    // rebuildReserveDisplay(playerTeam);
  }
}

async function handleClaimUsage(champion) {
  if (window.gameEnded) {
    alert("O jogo já terminou. Nenhuma ação pode ser realizada.");
    return;
  }

  if (!champion) return;

  if (champion.team !== playerTeam) {
    alert("Você só pode agir com campeões do seu time.");
    return;
  }

  if (!editMode.actMultipleTimesPerTurn && champion.hasActedThisTurn) {
    alert(`${champion.name} já agiu neste turno.`);
    return;
  }

  if (!editMode.freeCostSkills && CLAIM_MIN_MOMENTUM > champion.momentum) {
    alert("Momentum insuficiente para CLAIM.");
    champion.updateUI(currentTurn);
    return;
  }

  socket.emit("requestSkillUse", {
    userId: champion.id,
    skillKey: CLAIM_ACTION_KEY,
  });
}

function skipCurrentSlot() {
  if (currentActionBarSlot >= actionBarSlotOrder.length) return;
  currentActionBarSlot++;
  showActionBarSlot();
}

function removeActionBar() {
  removeSkillOverlay();

  if (actionBarEl) {
    actionBarEl.remove();
    actionBarEl = null;
  }
  if (skipSlotBtn) skipSlotBtn.disabled = true;
  // Rebuild reserve display disabled.
  // if (playerTeam !== null) rebuildReserveDisplay(playerTeam);
}

/* function handleSwitchViaReserveCard(reserveKey) {
  // Lógica de switch/reserva desativada.
  void reserveKey;
} */

// ============================================================
//  SURRENDER (Render-se)
// ============================================================

function openSurrenderDialog() {
  if (gameEnded || !playerTeam) return;
  if (settingsOverlay && settingsOverlay.classList.contains("active")) {
    settingsOverlay.classList.remove("active");
    settingsOverlay.classList.add("hidden");
  }
  surrenderOverlay.classList.remove("hidden");
  surrenderOverlay.classList.add("active");
}

function closeSurrenderDialog() {
  surrenderOverlay.classList.remove("active");
  surrenderOverlay.classList.add("hidden");
}

function confirmSurrender() {
  closeSurrenderDialog();
  surrenderBtn.disabled = true;
  socket.emit("surrender");
}

if (surrenderBtn) surrenderBtn.addEventListener("click", openSurrenderDialog);
if (surrenderCancel)
  surrenderCancel.addEventListener("click", closeSurrenderDialog);
if (surrenderConfirm)
  surrenderConfirm.addEventListener("click", confirmSurrender);

// Close on overlay backdrop click
if (surrenderOverlay) {
  surrenderOverlay.addEventListener("click", (e) => {
    if (e.target === surrenderOverlay) closeSurrenderDialog();
  });
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    surrenderOverlay &&
    surrenderOverlay.classList.contains("active")
  ) {
    closeSurrenderDialog();
  }
});

document.getElementById("undo-actions-btn").addEventListener("click", () => {
  socket.emit("requestUndoActions");
});
