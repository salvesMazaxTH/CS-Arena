import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
} from "../../shared/engine/combat/claim.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
//  IMPORTS
// ============================================================

import { championDB } from "/shared/data/championDB.js";
import { Champion } from "/shared/core/Champion.js";
import { StatusIndicator } from "../../shared/ui/statusIndicator.js";
import { createCombatAnimationManager } from "./animation/animsAndLogManager.js";
import { syncChampionVFX } from "../../shared/vfx/vfxManager.js";
import { audioManager } from "./utils/AudioManager.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import { createOverlays } from "./ui/overlays.js";
import {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
  getRequirementIdentity,
  buildIdentityGradient,
  applyIdentityPaletteCssVariables,
} from "../../shared/ui/identityPalette.js";

applyIdentityPaletteCssVariables(document.documentElement);

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

// --- Player identity ---
let playerId = null;
let playerTeam = null;
let username = null;
const playerNames = new Map(); // slot → username

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
let draggedChampionKey = null;
let draggedFromSlotIndex = -1; // -1 = available grid, >= 0 = selected slot

// --- Timers ---
let disconnectionCountdownInterval = null;
let countdownInterval = null;

// --- Overlays (extracted UI module) ---
const {
  showSkillOverlay,
  removeSkillOverlay,
  openChampionOverlay,
  showQuickStatsOverlay,
  hideQuickStatsOverlay,
} = createOverlays({
  getCurrentTurn: () => currentTurn,
  getPlayerTeam: () => playerTeam,
});

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
const endTurnBtn = document.querySelector("#end-turn-btn");
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

// Icons and colors for affinities/classes live in the shared identity palette
// so badges, emblem tiles and the stylesheet all read from the same source.
const affinityBadgeByKey = Object.freeze(
  Object.fromEntries(
    Object.entries(ELEMENT_IDENTITIES).map(([key, { icon }]) => [key, icon]),
  ),
);

const championClassConfig = CLASS_IDENTITIES;

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

function getChampionAffinityKeys(champion) {
  const affinities = Array.isArray(champion.elementalAffinities)
    ? champion.elementalAffinities
    : typeof champion.elementalAffinities === "string"
      ? [champion.elementalAffinities]
      : [];

  return affinities.map((affinity) =>
    String(affinity).trim().toLowerCase(),
  );
}

// One entry per supported requirement kind: how to read its target value out of
// the emblem data and how to count the roster champions that satisfy it.
// Emblems may combine several kinds (mixed emblems); all of them must pass.
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

/**
 * Flattens an emblem's requirements into renderable tokens, each carrying the
 * visual identity (emoji + color) the UI paints it with.
 */
function getEmblemRequirementTokens(requirements) {
  if (!requirements || typeof requirements !== "object") return [];

  return EMBLEM_REQUIREMENT_KINDS.flatMap((descriptor) => {
    const requirement = requirements[descriptor.kind];
    if (!requirement) return [];

    // baseStat targets a stat name (case-sensitive lookup); the others target a
    // normalized key.
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

function evaluateEmblemRequirements(emblem, rosterKeys = []) {
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const checks = getEmblemRequirementTokens(emblem?.requirements).map(
    (token) => {
      const actual = token.descriptor.countMatches(
        roster,
        token.target,
        token.threshold,
      );

      return {
        ...token,
        actual,
        pass: actual >= token.required,
      };
    },
  );

  return {
    allMet: checks.every((check) => check.pass),
    checks,
  };
}

/**
 * Requirement marker: the emoji when the identity has one, otherwise the name
 * spelled out (species are far too numerous to all have a symbol).
 */
function renderRequirementMarkerMarkup({ identity, label }) {
  const marker = identity.icon ?? identity.label ?? label;
  return `<span class="emblem-requirement-marker" title="${escapeHtml(label)}">${escapeHtml(marker)}</span>`;
}

/** e.g. `🥊 2/3 · ⚡ 1/2` — one marker + progress per requirement. */
function renderRequirementCountsMarkup(checks) {
  if (!checks.length) return "No requirements";

  return checks
    .map(
      (check) =>
        `${renderRequirementMarkerMarkup(check)} ${check.actual}/${check.required}`,
    )
    .join(" · ");
}

/** Paints the emblem tile with the color(s) of the requirement(s) it asks for. */
function getEmblemRequirementGradient(checks) {
  return buildIdentityGradient(checks.map((check) => check.identity));
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

    const requirementGradient = getEmblemRequirementGradient(
      requirementStatus.checks,
    );
    if (requirementGradient) {
      item.style.setProperty("--emblem-requirement-tint", requirementGradient);
    }

    item.innerHTML = `
      <span class="emblem-option-badge">${escapeHtml(getEmblemShortCode(emblem))}</span>
      <span class="emblem-option-copy">
        <strong>${escapeHtml(emblem.name || emblem.key)}</strong>
        <small>Requirements ${renderRequirementCountsMarkup(requirementStatus.checks)}</small>
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

  emitLineupSummon(championKey);
}

/** Sends a line-up summon request, unless one is already awaiting a server reply. */
/** Returns whether the request was actually sent. */
function emitLineupSummon(championKey) {
  if (!championKey || pendingSummonChampionKey) return false;

  pendingSummonChampionKey = championKey;
  socket.emit("summonFromLineup", { championKey });
  return true;
}

// ============================================================
//  UNUSED SUMMON REMINDER
// ============================================================
// Raised when the player is about to end a turn while a line-up summon is still
// available. Whether one is available is decided by the server and shipped with
// every gameStateUpdate; the client only decides when to raise the reminder.

let lineupSummonState = { canSummon: false, champions: [] };
let summonReminderEndsTurn = false;

const summonReminderOverlay = document.getElementById("summonReminderOverlay");
const summonReminderChips = document.getElementById("summonReminderChips");
const summonReminderDismiss = document.getElementById("summonReminderDismiss");

function isSummonReminderOpen() {
  return summonReminderOverlay?.classList.contains("active") === true;
}

/** Line-up champions the server would accept as a summon right now. */
function getSummonableLineupChampions() {
  if (!lineupSummonState?.canSummon) return [];
  return (lineupSummonState.champions || []).filter((key) => championDB[key]);
}

function openSummonReminder(championKeys) {
  if (!summonReminderOverlay || !summonReminderChips) return;

  summonReminderChips.classList.remove("is-busy");
  summonReminderChips.innerHTML = "";

  championKeys.forEach((championKey) => {
    const champion = championDB[championKey];

    const button = document.createElement("button");
    button.type = "button";
    button.className = "summon-reminder-chip";
    button.dataset.championKey = championKey;
    button.setAttribute("role", "listitem");

    button.innerHTML = `
      <span class="lineup-chip">${renderLineupChipContent(champion, 0)}</span>
      <span class="summon-reminder-chip-name">${escapeHtml(champion.name || championKey)}</span>
    `;

    button.addEventListener("click", () => summonFromReminder(button));
    summonReminderChips.appendChild(button);
  });

  summonReminderOverlay.classList.remove("hidden");
  // Force a reflow so the dialog animates in instead of appearing already opaque.
  void summonReminderOverlay.offsetWidth;
  summonReminderOverlay.classList.add("active");

  summonReminderChips.querySelector(".summon-reminder-chip")?.focus();
}

function closeSummonReminder() {
  if (!summonReminderOverlay) return;

  summonReminderOverlay.classList.remove("active");
  summonReminderChips?.classList.remove("is-busy");
  summonReminderEndsTurn = false;

  // Kept in the layout until the fade-out ends, then taken out of the page.
  window.setTimeout(() => {
    if (!isSummonReminderOpen()) summonReminderOverlay.classList.add("hidden");
  }, 300);
}

/** Summons the picked champion; the turn is ended once the server confirms it. */
function summonFromReminder(chipButton) {
  const championKey = chipButton?.dataset.championKey;
  if (!emitLineupSummon(championKey)) return;

  summonReminderEndsTurn = true;

  summonReminderChips.classList.add("is-busy");
  chipButton.classList.add("is-pending");
}

/** Called once the server confirms (or rejects) a summon requested from the reminder. */
function resolveSummonReminderRequest({ summoned }) {
  if (!isSummonReminderOpen()) {
    summonReminderEndsTurn = false;
    return;
  }

  if (!summoned) {
    // Rejected: hand the dialog back to the player instead of ending the turn.
    summonReminderEndsTurn = false;
    summonReminderChips?.classList.remove("is-busy");
    summonReminderChips
      ?.querySelector(".summon-reminder-chip.is-pending")
      ?.classList.remove("is-pending");
    return;
  }

  const shouldEndTurn = summonReminderEndsTurn;
  closeSummonReminder();
  if (shouldEndTurn) endTurn();
}

/**
 * End-of-turn gate: ends the turn straight away, unless the player still has a
 * line-up summon available — in that case the reminder is raised first.
 */
function requestEndTurn() {
  if (hasConfirmedEndTurn || isSummonReminderOpen()) return;

  const summonable = getSummonableLineupChampions();
  if (!summonable.length) {
    endTurn();
    return;
  }

  openSummonReminder(summonable);
}

summonReminderDismiss?.addEventListener("click", () => {
  closeSummonReminder();
  endTurn();
});

// Dismissing without choosing leaves the turn open — the End turn button in the
// header is the way back out, so the player is never cornered by the reminder.
summonReminderOverlay?.addEventListener("click", (event) => {
  if (event.target === summonReminderOverlay) closeSummonReminder();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSummonReminderOpen()) closeSummonReminder();
});

endTurnBtn?.addEventListener("click", () => requestEndTurn());

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

    // Manual cancel.
    if (target === null) return null;

    // Skipped slot.
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

    if (target === null) return null;
    if (target === undefined) return undefined;

    chosenTargets.add(target.id);
    const key = index === 1 ? "enemy" : `enemy${index}`;

    return { [key]: target };
  }

  console.error(`[selectTargetForRole] Unknown target role: ${role}`);
  return undefined;
}

// --- Target selection overlay ---

function createTargetSelectionOverlay(candidates, title) {
  // Remove skill overlay if open (fixes mobile bug)
  removeSkillOverlay && removeSkillOverlay();
  return new Promise((resolve) => {
    // If there are no candidates, avoid opening the empty selection UI.
    if (!Array.isArray(candidates) || candidates.length === 0) {
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

  if (playerTeam !== null) {
    if (!gameState?.lineupSummons) {
      // Older server payload: without it the client can never tell that a summon
      // is still available, so the end-of-turn reminder would stay silent.
      console.warn(
        "[GAME STATE] Payload has no lineupSummons — is the server running the current build?",
      );
    }

    lineupSummonState = gameState?.lineupSummons?.[playerTeam] ?? {
      canSummon: false,
      champions: [],
    };
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
    resolveSummonReminderRequest({ summoned: true });
  }
});

socket.on("scoreUpdate", (score) => {
  updateScoreDisplay(score);
});

socket.on("actionFailed", (message) => {
  console.warn("[ActionFailed]", message);
  pendingSummonChampionKey = null;
  resolveSummonReminderRequest({ summoned: false });
  combatAnimations.handleActionFailed(message);
});

socket.on("turnLocked", () => {
  document.getElementById("undo-actions-btn").disabled = true;
  hasConfirmedEndTurn = false;
  closeSummonReminder();
  removeActionBar();
});

socket.on("turnUpdate", (turn) => {
  combatAnimations.handleTurnUpdate(turn);
});

socket.on("gameOver", (data) => {
  combatAnimations.handleGameOver(data);
  gameEnded = true;
  closeSummonReminder();

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
  closeSummonReminder();
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
  // Reached again by any state refresh that rebuilds an already-finished action
  // bar, so a repeat call is normal and stays silent.
  if (hasConfirmedEndTurn) return;

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
//  COMBAT LOG
// ============================================================

socket.on("combatAction", (envelope) => {
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
  // A mid-turn summon refreshes the game state, which rebuilds the action bar
  // from slot 0 — champions that already locked in an action must not be asked
  // again, or the bar would rewind on every summon.
  if (!editMode.actMultipleTimesPerTurn && champion.hasActedThisTurn === true) {
    return true;
  }
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
  // A rebuild is never allowed to end the turn on the player's behalf: every
  // state refresh re-runs this, and the previous turn's acted flags are still
  // set while the resolution is being animated, which would silently confirm
  // the end of the turn (or pop the summon reminder) with nobody clicking.
  showActionBarSlot({ playerAdvanced: false });
}

/**
 * @param {{ playerAdvanced?: boolean }} options - playerAdvanced is true only
 *   when the bar moved on because the player locked in or skipped a slot, which
 *   is the only situation where running out of slots may end the turn.
 */
function showActionBarSlot({ playerAdvanced = true } = {}) {
  removeActionBar();
  if (currentActionBarSlot >= actionBarSlotOrder.length) {
    if (actionBarSlotOrder.length > 0) {
      if (playerAdvanced) requestEndTurn();
      // Kept available while the turn is still open, so a dismissed summon
      // reminder always has a way back to ending the turn.
      setEndTurnButtonVisible(!hasConfirmedEndTurn);
    }
    return;
  }

  const champion = getActionBarChampion();
  if (!champion) return;

  if (isChampionAutoSkippedInActionBar(champion)) {
    currentActionBarSlot++;
    showActionBarSlot({ playerAdvanced });
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
}

function advanceActionBarSlot(champId) {
  if (actionBarSlotOrder[currentActionBarSlot] === champId) {
    currentActionBarSlot++;
    showActionBarSlot();
    // Enable undo whenever a slot advances (there is a pending action).
    document.getElementById("undo-actions-btn").disabled = false;
  }
}

async function handleClaimUsage(champion) {
  if (window.gameEnded) {
    alert("The game has already ended. No action can be taken.");
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

function setEndTurnButtonVisible(visible) {
  endTurnBtn?.classList.toggle("hidden", !visible);
}

function removeActionBar() {
  removeSkillOverlay();

  if (actionBarEl) {
    actionBarEl.remove();
    actionBarEl = null;
  }
  if (skipSlotBtn) skipSlotBtn.disabled = true;
  setEndTurnButtonVisible(false);
}

// ============================================================
//  SURRENDER
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
