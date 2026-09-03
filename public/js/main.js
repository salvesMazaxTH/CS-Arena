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

// Overlay visibility: shown by swapping .hidden → .active; hidden the reverse.
function showOverlay(el) {
  el?.classList.remove("hidden");
  el?.classList.add("active");
}
function hideOverlay(el) {
  el?.classList.remove("active");
  el?.classList.add("hidden");
}

// ============================================================
//  IMPORTS
// ============================================================

import { championDB } from "/shared/data/championDB.js";
import { getDuoForCore } from "/shared/data/duos.js";
import { validateTeamComposition } from "/shared/data/teams/index.js";
import { TeamStore } from "./teamsManager/TeamStore.js";
import { renderTeamSummary } from "./ui/teamCard.js";
import { Champion } from "/shared/core/Champion.js";
import { SpawnProtection } from "/shared/engine/combat/spawnProtection.js";
import { StatusIndicator } from "../../shared/ui/statusIndicator.js";
import { createCombatAnimationManager } from "./animation/animsAndLogManager.js";
import { syncChampionVFX } from "../../shared/vfx/vfxManager.js";
import { audioManager } from "./utils/AudioManager.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import { createOverlays } from "./ui/overlays.js";
import { createTargeting } from "./ui/targeting.js";
import {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
  getRequirementIdentity,
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
//  GAME STATE
// ============================================================

// --- Player identity ---
let playerId = null;
let playerTeam = null;
let username = null;
const playerNames = new Map(); // slot → username

// --- Turn & Combat ---
let currentTurn = 1;
let hasConfirmedEndTurn = false;
// True from the moment the turn locks until its resolution has finished animating.
let isResolvingTurn = false;
let gameEnded = false;

// --- Active champions in the field ---
const activeChampions = new Map();

// --- Pre-match hub ---
const TEAM_SIZE = 8;
const teamStore = new TeamStore();
let selectedHubTeamId = null;
let matchmaking = false;

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

const { collectClientTargets } = createTargeting({
  getActiveChampions: () => activeChampions,
  removeSkillOverlay,
});

let playerEmblems = [];
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

// --- Pre-match hub ---
const hubScreen = document.getElementById("hub-screen");
const hubTeamGrid = document.getElementById("hubTeamGrid");
const hubEmpty = document.getElementById("hubEmpty");
const hubStatus = document.getElementById("hubStatus");
const hubFindMatchBtn = document.getElementById("hubFindMatchBtn");
const hubCancelBtn = document.getElementById("hubCancelBtn");

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
  applyTurnUpdate,
  syncStatusIndicatorRotation: () => StatusIndicator.syncRotationLoopState(),
  combatDialog,
  combatDialogText,
  editMode,

  onQueueEmpty: () => {
    socket.emit("combatAnimationsFinished");
  },

  onGameStateProcessed: () => {
    // While the turn is resolving nothing is clickable yet, and rebuilding the
    // bar there would also reveal the outcome before its animation plays.
    if (playerTeam !== null && !isResolvingTurn) initActionBar();
  },

  onChampionRemovalAnimated: () => {
    renderLineupBanners(lastLineupsByTeam);
    if (playerTeam !== null) renderLineupBanner();
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
  // Small delay for the CSS animation
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

  playerEmblems = Array.isArray(data.emblems) ? data.emblems.slice() : [];
  renderPlayerEmblemStrip();

  hideOverlay(loginScreen);
  openHub();

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
  // Attach listener for skipping slot (uses existing ref)
  if (skipSlotBtn) {
    skipSlotBtn.addEventListener("click", skipCurrentSlot);
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

  // Back to the login screen
  matchmaking = false;
  hideOverlay(hubScreen);
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");
  showOverlay(loginScreen);

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
    (e || window.event).returnValue = confirmationMessage; // For old browsers
    return confirmationMessage; // For modern browsers
  }
});

// ============================================================
//  PLAYERS NAMES & SCOREBOARD
// ============================================================

// ============================================================
//  PRE-MATCH HUB (team pick + matchmaking)
// ============================================================

function isTeamPlayable(team) {
  return (
    !!team &&
    validateTeamComposition(team, { championDB, emblems: EMBLEMS }).ok
  );
}

function openHub() {
  showOverlay(hubScreen);
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");
  selectedHubTeamId = teamStore.getSelectedId();
  renderHub();
}

function renderHub() {
  const teams = teamStore.getAll();
  hubEmpty.hidden = teams.length > 0;

  if (!teams.some((team) => team.id === selectedHubTeamId)) {
    selectedHubTeamId = teams[0]?.id ?? null;
  }

  hubTeamGrid.innerHTML = teams
    .map((team) => {
      const playable = isTeamPlayable(team);
      return `
        <button type="button"
          class="hub-team-card ${team.id === selectedHubTeamId ? "selected" : ""} ${playable ? "" : "is-invalid"}"
          data-team-id="${escapeHtml(team.id)}">
          ${renderTeamSummary(team)}
          ${playable ? "" : '<span class="hub-team-invalid">Unavailable — fix it in Manage teams</span>'}
        </button>
      `;
    })
    .join("");

  updateHubActionState();
}

function updateHubActionState() {
  hubFindMatchBtn.disabled =
    matchmaking || !isTeamPlayable(teamStore.getById(selectedHubTeamId));
  hubFindMatchBtn.hidden = matchmaking;
  hubCancelBtn.hidden = !matchmaking;
  hubTeamGrid.querySelectorAll(".hub-team-card").forEach((card) => {
    card.disabled = matchmaking || card.classList.contains("is-invalid");
  });
}

hubTeamGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".hub-team-card");
  if (!card || card.disabled) return;
  selectedHubTeamId = card.dataset.teamId;
  hubTeamGrid
    .querySelectorAll(".hub-team-card")
    .forEach((el) => el.classList.toggle("selected", el === card));
  updateHubActionState();
});

hubFindMatchBtn.addEventListener("click", () => {
  const team = teamStore.getById(selectedHubTeamId);
  const check = team
    ? validateTeamComposition(team, { championDB, emblems: EMBLEMS })
    : { ok: false, errors: ["Pick a team first."] };
  if (!check.ok) {
    hubStatus.textContent = check.errors[0];
    return;
  }

  teamStore.setSelectedId(team.id);
  playerRoster = team.champions.slice(0, TEAM_SIZE);
  playerEmblems = team.emblems.slice();
  renderPlayerEmblemStrip();
  renderLineupBanner();

  matchmaking = true;
  hubStatus.textContent = "Searching for a match…";
  updateHubActionState();
  socket.emit("readyWithTeam", {
    champions: team.champions,
    emblems: team.emblems,
  });
});

hubCancelBtn.addEventListener("click", () => {
  matchmaking = false;
  hubStatus.textContent = "";
  updateHubActionState();
  socket.emit("cancelReadyWithTeam");
});

// A team edited in the Team Manager tab reaches the hub through localStorage.
window.addEventListener("storage", (event) => {
  if (
    event.key?.startsWith("csa.teams") &&
    !hubScreen.classList.contains("hidden")
  ) {
    renderHub();
  }
});
window.addEventListener("focus", () => {
  if (!hubScreen.classList.contains("hidden") && !matchmaking) renderHub();
});

socket.on("readyWithTeamRejected", (message) => {
  matchmaking = false;
  hubStatus.textContent = message || "The server rejected that team.";
  updateHubActionState();
});

socket.on("allTeamsSelected", () => {
  matchmaking = false;
  hubStatus.textContent = "";
  hideOverlay(hubScreen);
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Play main soundtrack playlist (main2 twice because it's shorter than main).
  audioManager.playMusic(["main", "main2", "main2"]);
  resetLineupMaterializationState();
});

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

function getPlayerRosterForEmblemEligibility() {
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
      <img class="lineup-chip-portrait" src="${escapeHtml(champion.portrait || "/assets/portraits/placeholder.webp")}" alt="${escapeHtml(champion.name || "Champion")}">
      <span class="lineup-chip-identity-row">
        ${renderChampionIdentityBadgesMarkup(champion)}
      </span>
    </span>
  `;
}

// --- Lineup banner & initial 1v1 selection UI ---
let playerRoster = Array(TEAM_SIZE).fill(null); // copy of the player's confirmed roster
let firstChoicePending = false;
let firstChoiceSelected = null;
let firstChoiceResolved = false; // true once the first champion has been decided; chips stop opening the 1v1 overlay
const materializedLineupChampions = new Set();

// Where each line-up champion of either team stands, decided by the server.
let lineupStatuses = {};
let enemyLineupStatuses = {};
let lastLineupsByTeam = {};

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

// A duo's cores collapse into a single entry: they are summoned as one, so
// offering two chips that do the same thing would misrepresent the action.
function lineupEntries(championKeys) {
  const entries = [];
  const seenDuos = new Set();

  championKeys.forEach((championKey, index) => {
    const duo = getDuoForCore(championKey);

    if (!duo) {
      entries.push({ index, championKey });
      return;
    }

    if (seenDuos.has(duo.key)) return;
    seenDuos.add(duo.key);
    entries.push({ index, championKey: duo.cores[0], duo });
  });

  return entries;
}

function lineupEntryStatus({ championKey, duo }) {
  const keys = duo ? duo.cores : [championKey];
  if (!keys.length) return "reserve";

  const statuses = keys.map((key) => lineupStatuses[key] ?? "reserve");

  if (statuses.includes("nothingness")) return "nothingness";
  if (statuses.every((status) => status === "dead")) return "dead";
  return statuses.every((status) => status === "reserve") ? "reserve" : "field";
}

function renderLineupBanner() {
  if (!lineupBanner || !lineupChips) return;
  lineupChips.innerHTML = "";
  let hasAny = false;
  lineupEntries(playerRoster || []).forEach((entry) => {
    const { index: idx, championKey: champKey, duo } = entry;

    const chip = document.createElement("div");
    chip.className = "lineup-chip";
    chip.dataset.index = idx;
    chip.dataset.championKey = champKey || "";
    chip.title = duo
      ? `${duo.name} — summoned together, and they need ${duo.cores.length} free spaces`
      : champKey
        ? championDB[champKey]?.name || champKey
        : `Slot ${idx + 1}`;
    chip.classList.toggle(
      "selected",
      !!champKey &&
        (duo ? duo.cores.includes(firstChoiceSelected) : champKey === firstChoiceSelected),
    );
    chip.classList.toggle("duo-chip", !!duo);

    const status = lineupEntryStatus(entry);
    chip.classList.toggle("materialized", status !== "reserve");
    chip.classList.toggle("is-dead", status === "dead");
    chip.classList.toggle("in-nothingness", status === "nothingness");
    chip.classList.toggle(
      "summon-locked",
      firstChoiceResolved &&
        !!champKey &&
        !chip.classList.contains("materialized") &&
        pendingSummonChampionKey === champKey,
    );

    if (duo) {
      chip.innerHTML = renderLineupChipContent(duo, idx);
      hasAny = true;
    } else if (champKey && championDB[champKey]) {
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

  lineupEntries(championKeys).forEach(({ championKey, duo }) => {
    const entity = duo ?? championDB[championKey];

    const button = document.createElement("button");
    button.type = "button";
    button.className = "summon-reminder-chip";
    button.dataset.championKey = championKey;
    button.setAttribute("role", "listitem");

    button.innerHTML = `
      <span class="lineup-chip">${renderLineupChipContent(entity, 0)}</span>
      <span class="summon-reminder-chip-name">${escapeHtml(entity.name || championKey)}</span>
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

  renderLineupBanner();
}

function resetLineupMaterializationState() {
  materializedLineupChampions.clear();
  lineupStatuses = {};
  enemyLineupStatuses = {};
  if (!lineupChips) return;
  Array.from(lineupChips.children).forEach((chip) => {
    chip.classList.remove("materialized", "is-dead", "in-nothingness");
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

socket.on("firstChampionChoicesFinalized", () => {
  firstChoicePending = false;
  firstChoiceResolved = true;
  closeFirstChoiceOverlay();
  // rebuild banner read-only, without the click listener that opens the overlay
  renderLineupBanner();
});

// ============================================================
//  CHAMPION MANAGEMENT
// ============================================================

socket.on("championRemoved", (payload) => {
  combatAnimations.handleChampionRemoved(payload);
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
  champion.baseCritical = baseData.Critical ?? 0;
  champion.baseLifeSteal = baseData.LifeSteal ?? 0;

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

      const status = champKey
        ? (enemyLineupStatuses[champKey] ?? "reserve")
        : "reserve";
      const isMaterialized = status !== "reserve";

      const chipClass = `lineup-chip${
        isMaterialized ? " materialized" : " unrevealed"
      }${status === "dead" ? " is-dead" : ""}${
        status === "nothingness" ? " in-nothingness" : ""
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
//  TURN MANAGEMENT
// ============================================================

socket.on("gameStateUpdate", (gameState) => {
  const serverEmblems = gameState?.playerEmblems?.[playerTeam] ?? [];
  if (
    playerTeam !== null &&
    Array.isArray(serverEmblems) &&
    serverEmblems.length
  ) {
    playerEmblems = serverEmblems.slice();
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

    lineupStatuses = gameState?.lineupStatus?.[playerTeam] ?? {};
    enemyLineupStatuses =
      gameState?.lineupStatus?.[playerTeam === 1 ? 2 : 1] ?? {};
  }

  syncMaterializedLineupChampions(gameState?.champions || []);
  lastLineupsByTeam = gameState?.lineups ?? {};
  // Repainting here during a resolution would show a death on the banner while
  // the champion is still standing on the board.
  if (!isResolvingTurn) renderLineupBanners(lastLineupsByTeam);
  renderPlayerEmblemStrip();
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

socket.on("actionFailed", (message) => {
  console.warn("[ActionFailed]", message);
  pendingSummonChampionKey = null;
  resolveSummonReminderRequest({ summoned: false });
  combatAnimations.handleActionFailed(message);
});

socket.on("turnLocked", () => {
  document.getElementById("undo-actions-btn").disabled = true;
  hasConfirmedEndTurn = false;
  isResolvingTurn = true;
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
  combatAnimations.updateTurnDisplay(currentTurn);
  hasConfirmedEndTurn = false;
  isResolvingTurn = false;
  pendingSummonChampionKey = null;
  closeSummonReminder();
  renderLineupBanners(lastLineupsByTeam);
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
  if (SpawnProtection.isActive(champion)) return true;
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
    if (playerAdvanced && actionBarSlotOrder.length > 0) requestEndTurn();
    // Kept available while the turn is still open, so a dismissed summon
    // reminder always has a way back to ending the turn.
    setEndTurnButtonVisible(!hasConfirmedEndTurn);
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
  header.textContent = `Choose your action for Slot ${slotNumber} (${champion.name})`;
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
  claimBtn.title = "Scores points based on your current Momentum.";

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
    const label = skill.name;

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

    // Disable contact skill if champion is rooted or snared
    const hasMovementRestriction =
      champion.statusEffects &&
      champion.statusEffects.has &&
      (champion.statusEffects.has("rooted") || champion.statusEffects.has("snared"));
    if (skill.contact && hasMovementRestriction) {
      btn.disabled = true;
      btn.title = "Cannot use contact skills while restricted.";
    }

    if (isUlt) {
      const cost = champion.getSkillCost(skill);
      const hasResource = editMode.freeCostSkills || champion.momentum >= cost;
      if (!hasResource) btn.disabled = true;
    }

    // A skill may declare itself unavailable given the current board; the string
    // it returns doubles as the tooltip.
    const teammates = Array.from(activeChampions.values());
    const disabledReason = skill.disabledReason?.({
      user: champion,
      allies: teammates.filter((c) => c.team === champion.team),
      enemies: teammates.filter((c) => c.team !== champion.team),
    });
    if (disabledReason) {
      btn.disabled = true;
      btn.title = disabledReason;
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
    alert("You can only act with champions on your team.");
    return;
  }

  if (!editMode.actMultipleTimesPerTurn && champion.hasActedThisTurn) {
    alert(`${champion.name} has already acted this turn.`);
    return;
  }

  if (!editMode.freeCostSkills && CLAIM_MIN_MOMENTUM > champion.momentum) {
    alert("Not enough Momentum for CLAIM.");
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
    hideOverlay(settingsOverlay);
  }
  showOverlay(surrenderOverlay);
}

function closeSurrenderDialog() {
  hideOverlay(surrenderOverlay);
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
