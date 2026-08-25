// ============================================================
//  IMPORTS
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import livereload from "livereload";

const liveReloadServer = livereload.createServer();
liveReloadServer.watch("public");

process.on("SIGINT", () => {
  liveReloadServer.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  liveReloadServer.close();
  process.exit(0);
});

import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { Player } from "../shared/engine/match/Player.js";

import { championDB } from "../shared/data/championDB.js";
import { Champion } from "../shared/core/Champion.js";
import { formatChampionName } from "../shared/ui/formatters.js";

import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";
import { Action } from "../shared/engine/combat/Action.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";
import { CombatEnvelopeBuilder } from "../shared/engine/combat/CombatEnvelopeBuilder.js";

import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
} from "../shared/engine/combat/claim.js";

import { DamageEvent } from "../shared/engine/combat/DamageEvent.js";
import { getHardCCActionDenial } from "../shared/core/championStatus.js";
import { decayShields } from "../shared/core/championCombat.js";

import {
  EMBLEMS,
  evaluateEmblemEligibilityForRoster,
} from "../shared/data/emblems/index.js";

// ============================================================
//  CONFIGURATION
// ============================================================

const editMode = {
  enabled: false,
  autoLogin: false,
  autoSelection: false, // Auto-pick champions (skip the selection screen)
  actMultipleTimesPerTurn: false,
  unavailableChampions: false,
  damageOutput: null, // Fixed damage value for tests (e.g. 999). null = off. (SERVER-ONLY)
  alwaysCrit: false, // Force a crit on every attack. (SERVER-ONLY)
  alwaysEvade: false, // Force evasion on every attack. (SERVER-ONLY)
  executionOverride: null, // null = normal; number = forced threshold (1 = 100%, 0.5 = 50%)
  freeCostSkills: false, // Skills cost no resource. (SERVER-ONLY)
};

const TEAM_SIZE = 8;
const ACTIVE_PER_TEAM = 3; // max champions on the field per team (roster=8, active=3)
const MAX_MATCH_TURNS = 20; // game ends at the end of turn 20
const CHAMPION_SELECTION_TIME = 120; // seconds for champion selection
const FIRST_CHOICE_TIMEOUT = 45 * 1000; // 45s for the 1v1 pick before auto-selecting at random
const DISCONNECT_TIMEOUT = 30 * 1000; // 30s to reconnect

// ============================================================
//  HTTP SERVER & EXPRESS
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/shared", express.static(path.join(__dirname, "..", "shared")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ============================================================
//  GAME STATE
// ============================================================

const match = new GameMatch();
const envelopeBuilder = new CombatEnvelopeBuilder(match.combat);
let waitingForAnimations = false;

// ============================================================
//  STATE SERIALIZATION
// ============================================================

/**
 * Whether a team can still summon a line-up champion this turn, and which of its
 * reserve champions would actually be accepted right now.
 *
 * Mirrors the rules enforced by the "summonFromLineup" handler so the client can
 * remind the player about an unused summon without re-deriving them and drifting.
 */
function getLineupSummonAvailability(team) {
  if (match.getCurrentTurn() === 1 || match.hasSummonedThisTurn(team)) {
    return { canSummon: false, champions: [] };
  }

  const reserve = match.combat.reserveQueues.get(team) || [];

  const champions = reserve.filter((championKey) => {
    const baseData = championDB[championKey];
    if (!baseData) return false;

    return match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM, {
      entityType: baseData.entityType ?? "champion",
    });
  });

  return { canSummon: champions.length > 0, champions };
}

// Champions summoned this turn, hidden from the opponent until the turn locks —
// a mid-turn reinforcement is privileged information. Concealment lives in the
// payload (not the emit sites) so no stray broadcast can leak them.
const concealedSummonIds = new Set();

/** Reveals every concealed summon to everyone. Called when the turn locks. */
function revealConcealedSummons() {
  concealedSummonIds.clear();
}

/** A viewer sees their own team in full; everyone else waits for the reveal. */
function isConcealedFromViewer(serializedChampion, viewerTeam) {
  if (!concealedSummonIds.has(serializedChampion?.id)) return false;
  return viewerTeam == null || serializedChampion.team !== viewerTeam;
}

/**
 * Serializes the match state from one viewer's perspective.
 *
 * @param {object[]} [extraChampions] Champions to force into the payload (e.g. just-killed ones).
 * @param {object}   [options]
 * @param {number|null} [options.viewerTeam] Team of the recipient; null for spectators.
 */
function getGameState(extraChampions = [], { viewerTeam = null } = {}) {
  const champions = Array.from(match.combat.activeChampions.values()).map((c) =>
    c.serialize(),
  );

  // Force extra champions (e.g. just-killed ones) into the payload while the client still sees them as active.
  for (const extra of extraChampions) {
    if (extra && !champions.find((c) => c.id === extra.id)) {
      champions.push(extra.serialize());
    }
  }

  const visibleChampions = concealedSummonIds.size
    ? champions.filter((c) => !isConcealedFromViewer(c, viewerTeam))
    : champions;

  // Full 8-champion roster of each team, for the client's line-up banners.
  const lineups = {};
  const playerEmblems = {};
  const lineupSummons = {};
  for (const player of match.players) {
    if (!player) continue;
    lineups[player.team] = player.selectedChampionKeys || [];
    lineupSummons[player.team] = getLineupSummonAvailability(player.team);
    playerEmblems[player.team] = Array.isArray(player.emblems)
      ? player.emblems
          .map((emblem) => (typeof emblem === "string" ? emblem : emblem?.key))
          .filter(Boolean)
      : [];
  }

  return {
    champions: visibleChampions,
    currentTurn: match.combat.currentTurn,
    lineups,
    playerEmblems,
    lineupSummons,
  };
}

/** Team of the player behind a socket, or null when the socket is not playing. */
function getViewerTeam(socketId) {
  const slot = match.getSlotBySocket(socketId);
  if (slot === undefined) return null;
  return match.getPlayer(slot)?.team ?? null;
}

/**
 * Sends the game state to every connected socket, tailored to what that viewer
 * is allowed to know. Use this instead of io.emit("gameStateUpdate", ...) so a
 * concealed summon can never leak through an unrelated broadcast.
 */
function broadcastGameState(extraChampions = []) {
  if (concealedSummonIds.size === 0) {
    io.emit("gameStateUpdate", getGameState(extraChampions));
    return;
  }

  for (const [socketId, socket] of io.sockets.sockets) {
    socket.emit(
      "gameStateUpdate",
      getGameState(extraChampions, { viewerTeam: getViewerTeam(socketId) }),
    );
  }
}

// ============================================================
//  CHAMPION MANAGEMENT
// ============================================================

/** Whether a champion may be picked during draft (released, enabled, not a minion). */
function isChampionSelectableInDraft(championData) {
  if (!championData) return false;
  if ((championData.entityType ?? "champion") !== "champion") return false;
  if (championData.selectable === false) return false;
  if (championData.unreleased === true && !editMode.unavailableChampions)
    return false;
  if (championData.disabled === true && !editMode.unavailableChampions)
    return false;

  return true;
}

function getRandomChampionKey(excludeKeys = []) {
  const availableKeys = Object.keys(championDB).filter((key) => {
    if (excludeKeys.includes(key)) return false;
    return isChampionSelectableInDraft(championDB[key]);
  });
  if (availableKeys.length === 0) return null;
  return availableKeys[Math.floor(Math.random() * availableKeys.length)];
}

function fillRandomChampionSelection(currentSelection = [], fillAll = false) {
  const nextSelection = Array.isArray(currentSelection)
    ? currentSelection.slice()
    : [];

  while (nextSelection.length < TEAM_SIZE) {
    nextSelection.push(null);
  }

  for (let index = 0; index < nextSelection.length; index += 1) {
    if (!fillAll && nextSelection[index] !== null) continue;

    const champ = getRandomChampionKey(nextSelection.filter(Boolean));
    if (!champ) break;
    nextSelection[index] = champ;
  }

  return nextSelection.slice(0, TEAM_SIZE);
}

/** Cosmetic winter portrait swap, applied on spawn when the asset exists on disk. */
function applySeasonalSkin(champion) {
  if (Math.random() > 0.675) return;

  const fileName = champion.portrait.split("/").pop();
  if (!fileName) return;

  const baseName = fileName.replace(".webp", "");
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "assets",
    "portraits",
    `${baseName}_curtindo_o_inverno.webp`,
  );

  if (fs.existsSync(absolutePath)) {
    champion.portrait = `/assets/portraits/${baseName}_curtindo_o_inverno.webp`;
  }
}

/**
 * Spawns a champion through the combat model (which enforces the field cap and
 * fires onChampionAdded), applies the server-only seasonal skin, and — when
 * emitState — broadcasts the new state. Returns the instance, or null when it
 * could not be spawned.
 */
function spawnChampion({ emitState = true, ...spawnOpts } = {}) {
  const champion = match.combat.spawnChampion({
    ...spawnOpts,
    maxPerTeam: ACTIVE_PER_TEAM,
  });
  if (!champion) return null;

  applySeasonalSkin(champion);
  if (emitState) broadcastGameState();

  return champion;
}

/** Whether both players have selected their teams; notifies the clients when so. */
function checkAllTeamsSelected() {
  if (match.isTeamSelected(0) && match.isTeamSelected(1)) {
    io.emit("allTeamsSelected");
    broadcastGameState();
    return true;
  }
  return false;
}

/** Emits a champion's death sockets from a match.removeChampionFromGame() result. */
function emitChampionDeath(deathResult) {
  if (!deathResult) return;

  const champ = match.combat.getChampion(deathResult.championId);

  // Drop the dead champion's currentContext before serializing (avoids circular refs).
  if (champ?.runtime) delete champ.runtime.currentContext;

  if (deathResult.scoreAwarded && deathResult.scorePayload) {
    io.emit("combatAction", {
      action: null,
      scorePayload: deathResult.scorePayload,
      claimPoints: null,
      globalDialogs: [],
      state: getGameState(champ ? [champ] : []),
      log: `${deathResult.championName ?? "Champion"} was eliminated. Score updated.`,
    });
  }

  broadcastGameState(champ ? [champ] : []);
  io.emit("championRemoved", deathResult.championId);
}

// ============================================================
//  ACTION VALIDATION (pre-resolution)
// ============================================================

/**
 * Whether a champion may REQUEST a skill use. Called in "requestSkillUse" —
 * rejects immediately over the socket.
 */
function validateActionIntent(user, skill, socket) {
  if (!user.alive) {
    socket.emit("skillDenied", "Dead champion.");
    return false;
  }

  const hardCCDenial = getHardCCActionDenial(user);
  if (hardCCDenial) {
    socket.emit("skillDenied", hardCCDenial.message);
    return false;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Already acted this turn.");
    return false;
  }

  return true;
}

// ============================================================
//  MOMENTUM HELPERS
// ============================================================

/** Applies the global start-of-turn momentum regen (+12 per turn). */
function applyGlobalMomentumRegen(champion, context, resolver) {
  if (!champion || !champion.alive) return;

  const GLOBAL_MOMENTUM_REGEN = 12;

  if (resolver) {
    resolver.applyResourceChange({
      target: champion,
      amount: GLOBAL_MOMENTUM_REGEN,
      context,
      sourceId: champion.id,
      visualPhase: "global_turn_regen",
      visualAfterHooks: true,
      debugLabel: "global_turn_regen",
    });
  } else {
    champion.addMomentum(GLOBAL_MOMENTUM_REGEN);
  }
}

// ============================================================
//  COMBAT ACTION EMISSION (v2)
// ============================================================

/** Builds the action envelope via CombatEnvelopeBuilder and emits it if it has content. */
function emitCombatEnvelopesFromContext(params) {
  const envelope = envelopeBuilder.buildActionEnvelope(params);
  if (envelope) io.emit("combatAction", envelope);
}

function emitCombatLogsFromResults(results = []) {
  if (!Array.isArray(results) || results.length === 0) return;

  for (const log of envelopeBuilder.collectLogs(results)) {
    io.emit("combatLog", log);
  }
}

// ============================================================
//  TURN RESOLUTION
// ============================================================

function emitGameOverIfNeeded({ checkTurnLimit = false } = {}) {
  const gameEnd = match.checkGameEnd({
    maxTurns: MAX_MATCH_TURNS,
    checkTurnLimit,
  });

  if (!gameEnd.ended) return;

  const winnerSlot = gameEnd.winnerSlot;
  const winnerTeam = winnerSlot != null ? winnerSlot + 1 : null;
  const winnerName =
    winnerSlot != null ? match.players[winnerSlot]?.username : null;

  io.emit("gameOver", { winnerTeam, winnerName });
}

function handleEndTurn() {
  io.emit("turnLocked");

  // Nobody can act any more, so this is the moment the line-up summons made
  // during the turn become public — right before their actions are resolved.
  revealConcealedSummons();
  broadcastGameState();

  // Resolve every action through the TurnResolver.
  const resolver = new TurnResolver(match, editMode, {
    mutationHandler: (request, meta = {}) =>
      match.combat.mutateChampion(request, { context: meta.context ?? null }),
  });
  const { actionResults, deathResults } = resolver.resolveTurn();

  // Collect all championMutationRequests BEFORE emitting envelopes; they are
  // processed after deathResults so the new creature is never flagged as dead.
  const allChampionMutationRequests = [];

  for (const result of actionResults) {
    if (result.executed) {
      const actionLog = envelopeBuilder.collectLogs(result.results).join("\n");

      emitCombatEnvelopesFromContext({
        user: result.user,
        skill: result.skill,
        context: result.context,
        scorePayload: result.scorePayload ?? null,
        claimPoints: result.claimPoints ?? null,
        log: actionLog || null,
      });

      const championMutationRequests =
        result.context?.flags?.championMutationRequests;
      if (championMutationRequests?.length) {
        allChampionMutationRequests.push(...championMutationRequests);
      }
    } else if (result.reason === "denied" && result.denial) {
      const globalDialogs = result.context?.visual?.globalDialogs || [];
      if (!globalDialogs.length) {
        globalDialogs.push({ message: result.denial.message });
      }

      io.emit("combatAction", {
        globalDialogs,
        state: result.context?._intermediateSnapshot ?? null,
      });
    } else if (result.logMessage) {
      io.emit("combatLog", result.logMessage);
    }
  }

  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  // Now process championMutationRequests (after deathResults) so the new
  // creature is not registered as dead.
  if (allChampionMutationRequests.length > 0) {
    for (const req of allChampionMutationRequests) {
      match.combat.mutateChampion(req);
    }

    broadcastGameState();
  }

  const context = {
    currentTurn: match.combat.currentTurn,
    activeChampions: Array.from(match.combat.activeChampions.values()).filter(
      (c) => c.alive,
    ),
  };

  emitCombatEvent("onTurnEnd", { context }, match.combat.activeChampions);

  // Turn cleanup and advance.
  match.clearActions();
  match.clearTurnReadiness();
  match.clearFinishedAnimationSockets();
  match.clearTurnSummons();

  // Check game end (roster wipe, turn limit or score threshold) only after every
  // other end-of-turn task.
  emitGameOverIfNeeded({ checkTurnLimit: true });

  if (!match.isGameEnded()) {
    match.nextTurn();
  }

  // Signal clients that every combat event has been emitted.
  waitingForAnimations = true;
  io.emit("combatPhaseComplete");
}

function handleScheduledEffect(effect, context) {
  switch (effect.type) {
    case "spawnChampion": {
      // On a revival, remove the old instance before spawning the new one.
      if (effect.payload.reviveFrom && effect.payload.reviveFrom.id) {
        match.combat.removeChampion(effect.payload.reviveFrom.id);
      }
      // Keeps the revived champion on its original combatSlot.
      const spawned = spawnChampion({
        ...effect.payload,
        combatSlot: effect.payload.combatSlot ?? null,
      });

      if (!spawned) {
        // Field full (or no slot left): the scheduled entry is simply lost.
        // That is the intended rule, but it must never pass unnoticed.
        console.warn(
          `[SCHEDULED SPAWN] Failed for ${effect.payload.championKey} (team ${effect.payload.team}).`,
          effect.payload.reviveFrom
            ? "It was a revival — the champion was lost."
            : "",
        );

        if (effect.payload.reviveFrom && context?.registerDialog) {
          context.registerDialog({
            message: `${formatChampionName(
              effect.payload.reviveFrom,
            )} found no room on the battlefield and could not return.`,
            sourceId: null,
            targetId: null,
          });
        }

        // Without a spawn there is no return message to show.
        effect.dialog = null;
        break;
      }

      // Supports state transfer from the previous instance.
      if (typeof effect.payload.onSpawn === "function") {
        // When reviveFrom is present, it is injected as the 3rd argument.
        effect.payload.onSpawn(
          spawned,
          context,
          effect.payload.reviveFrom || null,
        );
      }
      break;
    }

    case "damage": {
      const resolver = new TurnResolver(match, editMode);
      const ctx = resolver.createBaseContext({
        sourceId: effect.payload.attackerId,
      });
      const targets = Array.isArray(effect.payload.defenderIds)
        ? effect.payload.defenderIds
        : [effect.payload.defenderId];

      for (const defId of targets) {
        const attacker = match.combat.activeChampions.get(
          effect.payload.attackerId,
        );
        const defender = match.combat.activeChampions.get(defId);
        if (!attacker || !defender || !defender.alive) continue;

        const dmg = new DamageEvent({
          attacker,
          defender,
          skill: effect.payload.skill ?? null,
          context: ctx,
          baseDamage: effect.payload.baseDamage ?? 0,
          mode: effect.payload.mode,
          piercingPortion: effect.payload.piercingPortion,
          allChampions: match.combat.activeChampions,
        });
        dmg.execute();
      }
      break;
    }

    // A status effect deliberately postponed to a later turn (e.g. the Barão's
    // Reactor Overload). It lands here inside handleStartTurn, *before* the
    // expiration purge, so a duration of 1 covers exactly this turn's
    // resolution and is purged at the start of the next one.
    case "applyStatusEffect": {
      const {
        targetId,
        statusEffectKey,
        duration = 1,
        metadata = {},
        stackCount = 1,
        dialog = null,
      } = effect.payload ?? {};

      const target = match.combat.activeChampions.get(targetId);
      if (!target || !target.alive || !statusEffectKey) break;

      target.applyStatusEffect(
        statusEffectKey,
        duration,
        context ?? { currentTurn: match.combat.currentTurn },
        metadata,
        stackCount,
      );

      if (dialog && context?.registerDialog) {
        context.registerDialog({
          message: dialog,
          sourceId: target.id,
          targetId: target.id,
        });
      }
      break;
    }

    case "championMutation": {
      const result = match.combat.mutateChampion(effect.payload);
      if (result?.log && context?.registerDialog) {
        context.registerDialog({
          message: result.log,
          sourceId: result.champion?.id ?? null,
          targetId: result.champion?.id ?? null,
        });
      }
      return result;
    }

    default:
      if (typeof effect.execute === "function") {
        effect.execute();
      }
      break;
  }
}

/** Runs start-of-turn processing: scheduled effects, hooks, purges and global regen. */
function handleStartTurn() {
  const currentTurn = match.combat.currentTurn;
  const currentTurnEffects = [];
  const futureEffects = [];
  const preTurnMutationResults = [];

  for (const effect of match.combat.scheduledEffects) {
    if (effect.turnToHappen === currentTurn) {
      currentTurnEffects.push(effect);
    } else {
      futureEffects.push(effect);
    }
  }

  const preTurnMutationEffects = currentTurnEffects.filter(
    (effect) => effect.type === "championMutation",
  );
  const deferredTurnEffects = currentTurnEffects.filter(
    (effect) => effect.type !== "championMutation",
  );

  match.combat.scheduledEffects = [...deferredTurnEffects, ...futureEffects];

  for (const effect of preTurnMutationEffects) {
    const result = handleScheduledEffect(effect, null);
    if (result?.log) {
      preTurnMutationResults.push(result);
    }
  }

  const resolver = new TurnResolver(match, editMode);

  const turnStartContext = resolver.createBaseContext({ sourceId: null });

  for (const result of preTurnMutationResults) {
    turnStartContext.registerDialog({
      message: result.log,
      sourceId: result.champion?.id ?? null,
      targetId: result.champion?.id ?? null,
    });
  }

  // Inject context.
  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    decayShields(champ, currentTurn);
  });

  // onTurnStart hooks (DoTs, reactive passives, etc.).
  // Skip turn 1 — there are no previous effects to process on the first turn.
  let turnStartResults = [];
  if (currentTurn > 1) {
    turnStartResults = emitCombatEvent(
      "onTurnStart",
      { context: turnStartContext },
      match.combat.activeChampions,
    );

    emitCombatLogsFromResults(turnStartResults);
  }

  // Run this turn's scheduled effects (including any scheduled during onTurnStart).
  const remaining = [];

  for (const effect of match.combat.scheduledEffects) {
    if (effect.turnToHappen === currentTurn) {
      handleScheduledEffect(effect, turnStartContext);
      if (effect.dialog) {
        // A scheduled dialog announces the effect itself, so it must land in
        // globalDialogs instead of being glued to whatever event the effect
        // registered last (a revive's own buffs, for instance) — those events
        // may target a champion the client does not know about yet.
        turnStartContext._lastEventRef = null;
        turnStartContext.registerDialog(effect.dialog);
      }
    } else {
      remaining.push(effect);
    }
  }
  match.combat.scheduledEffects = remaining;

  const deathResults = resolver.processChampionDeaths(turnStartContext);

  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  // Start-of-turn hooks (e.g. Jeff's Inevitabilidade da Morte) can kill the
  // last real champion outside the regular end-turn action flow.
  emitGameOverIfNeeded();

  // Purge expired effects.
  match.combat.activeChampions.forEach((champion) => {
    champion.purgeExpiredStatModifiers(match.combat.currentTurn);
    champion.purgeExpiredStatusEffects(
      match.combat.currentTurn,
      turnStartContext,
    );
    champion.purgeExpiredHookEffects(match.combat.currentTurn);
  });

  // Global momentum regen.
  match.combat.activeChampions.forEach((champion) => {
    applyGlobalMomentumRegen(champion, turnStartContext, resolver);
  });

  // Clear the runtime context.
  match.combat.activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "turn_start", name: "Turn Start" },
    context: turnStartContext,
  });

  io.emit("turnUpdate", match.combat.currentTurn);
  broadcastGameState();
}

// ============================================================
//  GAME STATE RESET
// ============================================================

/** Fully resets the game state (everyone disconnected or timed out). */
function resetGameState() {
  revealConcealedSummons();
  match.clearPlayers();
}

/** Resets combat state (HP, buffs, ult, etc.) while keeping champions and players (debug/test only). */
function resetCombatState() {
  const snapshot = [...match.combat.combatSnapshot];

  revealConcealedSummons();
  match.combat.reset();

  for (const champ of snapshot) {
    const baseData = championDB[champ.championKey];

    const newChampion = Champion.fromBaseData(baseData, champ.id, champ.team, {
      combatSlot: champ.combatSlot,
    });

    match.combat.registerChampion(newChampion, { trackSnapshot: false });
  }

  match.combat.combatSnapshot = snapshot;
  match.combat.start();
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  console.log("Total connected users:", io.engine.clientsCount);

  // Send editMode to the client immediately, WITHOUT server-only fields (damageOutput, alwaysCrit, etc.).
  const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
  socket.emit("editModeUpdate", clientEditMode);

  // Combat reset (debug).
  socket.on("debugResetCombat", () => {
    resetCombatState();
    broadcastGameState();
  });

  // Start of turn, once animations finish on both clients.
  socket.on("combatAnimationsFinished", () => {
    if (!waitingForAnimations) return;
    if (match.getSlotBySocket(socket.id) === undefined) return;

    match.addFinishedAnimationSocket(socket.id);

    if (match.getFinishedAnimationCount() >= 2) {
      waitingForAnimations = false;
      match.clearFinishedAnimationSockets();
      handleStartTurn();
    }
  });

  // --- Connection-scoped helpers ---

  /** Assigns a player slot and notifies the client. */
  function assignPlayerSlot(username) {
    // If this socket already owns a slot, don't create another (avoids autoLogin + manual-click duplication).
    const existingSlot = match.getSlotBySocket(socket.id);
    if (existingSlot !== undefined) {
      const existingPlayer = match.getPlayer(existingSlot);
      if (existingPlayer) {
        return {
          playerSlot: existingSlot,
          finalUsername: existingPlayer.username,
        };
      }
    }

    let slot = -1;
    if (match.getPlayer(0) === null) slot = 0;
    else if (match.getPlayer(1) === null) slot = 1;

    if (slot === -1) {
      socket.emit("serverFull", "The server is full. Please try again later.");
      socket.disconnect();
      return null;
    }

    const playerId = `player${slot + 1}`;
    const team = slot + 1;
    const finalUsername =
      editMode.enabled && editMode.autoLogin ? `Player${slot + 1}` : username;

    const player = new Player({
      id: playerId,
      team,
      username: finalUsername,
    });

    player.emblems = [];

    player.setSocket(socket.id);
    player.clearChampionSelection();

    match.setPlayer(slot, player);

    match.assignSocketToSlot(socket.id, slot);

    socket.emit("playerAssigned", {
      playerId,
      team,
      username: finalUsername,
      emblems: player.emblems.map((emblem) =>
        typeof emblem === "string" ? emblem : emblem.key,
      ),
    });
    io.emit("playerCountUpdate", match.getConnectedCount());
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
    socket.emit(
      "gameStateUpdate",
      getGameState([], { viewerTeam: getViewerTeam(socket.id) }),
    );

    return { playerSlot: slot, finalUsername };
  }

  /** Starts champion selection for pending players. */
  function handleChampionSelection() {
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      if (!player || player.isTeamSelected()) continue;

      io.to(player.socketId).emit("startChampionSelection", {
        timeLeft: CHAMPION_SELECTION_TIME,
      });

      match.setSelectionTimer(
        i,
        setTimeout(() => {
          if (match.isTeamSelected(i)) return;

          const currentSelection = fillRandomChampionSelection(
            player.selectedChampionKeys,
            false,
          );

          player.setSelectedChampionKeys(currentSelection);
          if (checkAllTeamsSelected()) {
            startGameIfReady();
          }
        }, CHAMPION_SELECTION_TIME * 1000),
      );
    }
  }

  /** Auto-selection (editMode); otherwise defers to manual selection. */
  function handleEditModeSelection() {
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      if (!player || player.isTeamSelected()) continue;

      const currentSelection = fillRandomChampionSelection([], true);
      player.setSelectedChampionKeys(currentSelection);
    }

    if (checkAllTeamsSelected()) {
      startGameIfReady();
    }
  }

  // =============================
  //  requestPlayerSlot
  // =============================

  socket.on("requestPlayerSlot", (username) => {
    const assignResult = assignPlayerSlot(username);
    if (!assignResult) return;

    const { playerSlot, finalUsername } = assignResult;

    // Wait for the second player.
    if (!match.areBothPlayersConnected()) {
      socket.emit(
        "waitingForOpponent",
        `Hello, ${finalUsername}, waiting for the other player...`,
      );
      return;
    }

    io.emit("allPlayersConnected");

    // Champion selection.
    if (editMode.enabled && editMode.autoSelection) {
      handleEditModeSelection();
    } else {
      handleChampionSelection();
    }

    // Reconnection — cancel the timer and notify the opponent.
    if (match.getDisconnectionTimer(playerSlot)) {
      match.clearDisconnectionTimer(playerSlot);

      const otherPlayer = match.getOpponent(playerSlot);
      if (otherPlayer) {
        io.to(otherPlayer.socketId).emit("opponentReconnected");
      }
    }
  });

  function startGameIfReady() {
    if (!checkAllTeamsSelected()) return;
    if (match.isCombatStarted()) return;

    match.combat.start();

    // Populate each team's reserve queue with its confirmed roster, then start
    // the first-champion (initial 1v1) choice phase.
    match.players.forEach((player) => {
      if (!player) return;
      match.combat.reserveQueues.set(player.team, [
        ...player.selectedChampionKeys,
      ]);
    });

    startFirstChampionChoicePhase();
  }

  /** Starts the first-champion (1v1) choice phase. */
  function startFirstChampionChoicePhase() {
    match.players.forEach((player) => {
      if (!player) return;

      const team = match.getPlayerTeam(player.socketId);
      const roster = match.combat.reserveQueues.get(team) || [];

      io.to(player.socketId).emit("requestFirstChampionSelection", {
        roster,
        timeout: FIRST_CHOICE_TIMEOUT,
      });

      // Schedule the auto-pick timeout: a random champion from the roster.
      const timeoutId = setTimeout(() => {
        if (!match.combat.firstChampionChoices.has(player.socketId)) {
          console.log(
            `[TIMEOUT] Player ${player.username} did not choose. Auto-selecting at random.`,
          );
          const autoSelectedChampion =
            roster[Math.floor(Math.random() * roster.length)];
          if (autoSelectedChampion) {
            handleFirstChampionChoice(player.socketId, autoSelectedChampion);
          }
        }
      }, FIRST_CHOICE_TIMEOUT);

      match.setFirstChoiceTimer(player.socketId, timeoutId);
    });
  }

  /** Processes a player's first-champion choice. */
  function handleFirstChampionChoice(socketId, championKey) {
    const player = match.getPlayerBySocketId(socketId);
    if (!player) return;

    // Clears the timeout and records the choice in GameMatch.
    const alreadyChosen = !match.setFirstChampionChoice(socketId, championKey);
    if (alreadyChosen) return;

    console.log(
      `Player ${player.username} chose ${formatChampionName(
        championDB[championKey],
      )} for the 1v1.`,
    );

    if (match.combat.firstChampionChoices.size === 2) {
      handleAllFirstChampionsChosen();
    }
  }

  /** When both players have chosen their initial champion. */
  function handleAllFirstChampionsChosen() {
    // Prevents multiple executions.
    if (match.combat.activeChampions.size > 0) return;

    console.log("Both players have chosen. Starting the 1v1.");

    // Finalize the choice phase in GameMatch (spawns, updates reserves).
    const { choices } = match.finalizeFirstChampionChoices(spawnChampion);

    io.emit("firstChampionChoicesFinalized", { choices });
    broadcastGameState();

    // Start the first turn after a small UI delay.
    setTimeout(() => {
      handleStartTurn();
      io.emit("turnStart", {
        turn: match.combat.currentTurn,
        activeChampions: Array.from(match.combat.activeChampions.keys()),
      });
    }, 1000);
  }

  // =============================
  //  disconnect
  // =============================

  socket.on("disconnect", () => {
    let disconnectedSlot = match.getSlotBySocket(socket.id);

    if (disconnectedSlot === undefined) {
      // Fallback: look it up in the players array.
      disconnectedSlot = match.players.findIndex(
        (player) => player && player.socketId === socket.id,
      );
    }

    if (disconnectedSlot === -1 || disconnectedSlot === undefined) {
      console.warn("Disconnect from an unmapped socket:", socket.id);
      return;
    }

    const wasGameActive = match.areBothPlayersConnected();

    // Clear pending timers.
    match.clearDisconnectionTimer(disconnectedSlot);
    match.clearSelectionTimer(disconnectedSlot);

    // Release the slot.
    const disconnectedPlayer = match.getPlayer(disconnectedSlot);
    disconnectedPlayer?.clearSocket();
    disconnectedPlayer?.clearChampionSelection();
    match.setPlayer(disconnectedSlot, null);
    match.removeSocket(socket.id);
    match.removeReadyPlayer(disconnectedSlot);
    match.clearActions();

    const connectedCount = match.getConnectedCount();
    io.emit("playerCountUpdate", connectedCount);
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());

    // No players left — full reset.
    if (connectedCount === 0) {
      resetGameState();
      broadcastGameState();
      return;
    }

    // One player left with an active game — start the countdown.
    if (wasGameActive && connectedCount === 1) {
      const remainingSlot = match.players[0] ? 0 : 1;
      const remainingSocketId = match.players[remainingSlot].socketId;

      io.to(remainingSocketId).emit("opponentDisconnected", {
        timeout: DISCONNECT_TIMEOUT,
      });

      const timer = setTimeout(() => {
        io.to(remainingSocketId).emit(
          "forceLogout",
          "Your opponent disconnected and did not reconnect in time.",
        );

        match.setPlayer(remainingSlot, null);
        match.removeSocket(remainingSocketId);
        resetGameState();
        io.emit("playerCountUpdate", match.getConnectedCount());
        io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
        broadcastGameState();
      }, DISCONNECT_TIMEOUT);

      match.setDisconnectionTimer(disconnectedSlot, timer);
    }
  });

  // =============================
  //  sync emblem selection
  // =============================

  socket.on("updatePlayerEmblems", ({ emblems, draftRoster } = {}) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];

    if (!player) {
      return socket.emit("actionFailed", "You are not in an active match.");
    }

    const selectedKeys = Array.isArray(emblems) ? emblems : [];
    const validKeys = selectedKeys.filter((key) =>
      EMBLEMS.some((emblem) => emblem.key === key),
    );

    if (validKeys.length > 2) {
      return socket.emit(
        "actionFailed",
        "You can select at most 2 active Emblems.",
      );
    }

    // Before the team is confirmed, selectedChampionKeys is still empty on the
    // server. We use the provisional roster sent by the client (draft in
    // progress) for this check; the final, authoritative validation happens
    // again in the "selectTeam" handler against the truly confirmed line-up.
    const rosterKeys = player.isTeamSelected()
      ? player.selectedChampionKeys
      : Array.isArray(draftRoster)
        ? draftRoster.filter(
            (key) => typeof key === "string" && championDB[key],
          )
        : [];

    const nextEmblems = validKeys
      .slice(0, 2)
      .map((key) => EMBLEMS.find((item) => item.key === key))
      .filter(Boolean);

    const invalidForRoster = nextEmblems.find(
      (emblem) =>
        !evaluateEmblemEligibilityForRoster(emblem, rosterKeys, championDB),
    );

    if (invalidForRoster) {
      return socket.emit(
        "actionFailed",
        `This Emblem is not eligible for your current line-up: ${invalidForRoster.name}.`,
      );
    }

    player.emblems = nextEmblems;

    socket.emit("playerEmblemsUpdated", {
      emblems: player.emblems.map((emblem) => emblem.key),
    });
    broadcastGameState();
  });

  // =============================
  //  selectTeam
  // =============================

  socket.on(
    "selectTeam",
    ({ team: clientTeam, champions: selectedChampionKeys }) => {
      const playerSlot = match.getSlotBySocket(socket.id);
      const player = match.players[playerSlot];

      if (!player || player.team !== clientTeam) {
        socket.emit(
          "actionFailed",
          "You are not allowed to select champions for this team.",
        );
        return;
      }

      if (player.isTeamSelected()) {
        socket.emit("actionFailed", "You have already confirmed your team.");
        return;
      }

      // Server-authoritative validation: reject invalid keys.
      const invalidKey = selectedChampionKeys.find((key) => {
        const data = championDB[key];
        return !isChampionSelectableInDraft(data);
      });

      if (invalidKey) {
        socket.emit("actionFailed", `Invalid champion in selection: ${invalidKey}`);
        return;
      }

      player.setSelectedChampionKeys(selectedChampionKeys);

      const invalidEmblem = player.emblems.find(
        (emblem) =>
          !evaluateEmblemEligibilityForRoster(
            emblem,
            selectedChampionKeys,
            championDB,
          ),
      );

      if (invalidEmblem) {
        socket.emit(
          "actionFailed",
          `Your Emblem selection is not valid for the final line-up: ${invalidEmblem.name}.`,
        );
        return;
      }

      startGameIfReady();
    },
  );

  // =============================
  //  chooseFirstChampion (1v1 initial)
  // =============================
  socket.on("chooseFirstChampion", ({ championKey } = {}) => {
    handleFirstChampionChoice(socket.id, championKey);
  });

  // =============================
  //  summonFromLineup (brings a line-up champion onto the field)
  // =============================
  socket.on("summonFromLineup", ({ championKey } = {}) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.getPlayer(playerSlot);
    if (!player) return;

    const team = player.team;

    // Line-up summons are blocked on the first turn.
    if (match.getCurrentTurn() === 1) {
      return socket.emit(
        "actionFailed",
        "You cannot summon line-up champions on the first turn.",
      );
    }

    if (match.hasSummonedThisTurn(team)) {
      return socket.emit(
        "actionFailed",
        "You have already summoned a line-up champion this turn.",
      );
    }

    const reserve = match.combat.reserveQueues.get(team) || [];
    if (!championKey || !reserve.includes(championKey)) {
      return socket.emit(
        "actionFailed",
        "That champion is not available to be summoned.",
      );
    }

    // The field cap counts champions only — minions are always allowed in.
    const summonEntityType = championDB[championKey]?.entityType ?? "champion";

    if (
      !match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM, {
        entityType: summonEntityType,
      })
    ) {
      return socket.emit(
        "actionFailed",
        "There is no free space on the battlefield to summon more champions.",
      );
    }

    const spawned = spawnChampion({
      championKey,
      team,
      trackSnapshot: true,
      emitState: false,
    });
    if (!spawned) {
      return socket.emit("actionFailed", "This champion could not be summoned.");
    }

    match.combat.reserveQueues.set(
      team,
      reserve.filter((key) => key !== championKey),
    );
    match.markSummonedThisTurn(team);

    // The opponent is still choosing actions, so this reinforcement stays hidden
    // from them until the turn locks and resolution begins.
    concealedSummonIds.add(spawned.id);

    // Emitted only after the bookkeeping above, so the payload's summon
    // availability already reflects this summon.
    broadcastGameState();

    match.logTurnEvent("championSummoned", {
      championId: spawned.id,
      championKey,
      team,
    });
  });

  socket.on("requestSkillUse", ({ userId, skillKey, targetId }) => {
    const user = match.combat.activeChampions.get(userId);
    if (!user) return socket.emit("skillDenied", "Not allowed.");

    if (skillKey === CLAIM_ACTION_KEY) {
      if (!validateActionIntent(user, null, socket)) return;

      if (
        !editMode.freeCostSkills &&
        (Number(user.momentum) || 0) < CLAIM_MIN_MOMENTUM
      ) {
        return socket.emit("skillDenied", `Not enough Momentum.`);
      }

      return socket.emit("skillApproved", { userId, skillKey });
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) return socket.emit("skillDenied", "Invalid skill.");

    if (!validateActionIntent(user, skill, socket)) return;

    if (!skill.isUltimate) {
      return socket.emit("skillApproved", { userId, skillKey });
    }

    const cost = user.getSkillCost(skill);

    if (!editMode.freeCostSkills && cost > user.momentum) {
      return socket.emit("skillDenied", `Not enough Momentum.`);
    }

    socket.emit("skillApproved", { userId, skillKey });
  });

  // =============================
  //  requestUndoActions (cancels the player team's pending actions)
  // =============================
  socket.on("requestUndoActions", () => {
    const playerSlot = match.getSlotBySocket(socket.id);

    if (playerSlot === undefined) return;

    const playerTeam = playerSlot + 1;

    for (let i = match.combat.pendingActions.length - 1; i >= 0; i--) {
      // Nothing left in the array — leave the loop (execution continues below it).
      if (!match.combat.pendingActions.length) {
        console.warn("Undo request with no pending actions.");
        break;
      }
      const action = match.combat.pendingActions[i];
      const champ = match.combat.activeChampions.get(action.userId);

      if (!champ) continue;

      if (champ.team !== playerTeam) continue;

      // Revert state.
      champ.hasActedThisTurn = false;

      if (action.momentumCost > 0) {
        champ.addMomentum({ amount: action.momentumCost });
      }

      match.combat.pendingActions.splice(i, 1);
    }

    // Remove the end-of-turn confirmation.
    if (match.isPlayerReady(playerSlot)) {
      match.removeReadyPlayer(playerSlot);
      io.emit("playerCanceledEndTurn", playerSlot);
    }

    socket.emit("actionsCanceled");
  });

  // =============================
  //  useSkill (enqueues a pending action)
  // =============================

  socket.on("useSkill", ({ userId, skillKey, targetIds }) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    const user = match.combat.activeChampions.get(userId);

    if (skillKey === CLAIM_ACTION_KEY) {
      if (!player || !user || user.team !== player.team) {
        return socket.emit(
          "actionFailed",
          "You are not allowed to use CLAIM with this champion.",
        );
      }

      if (!validateActionIntent(user, null, socket)) return;

      if (
        !editMode.freeCostSkills &&
        (Number(user.momentum) || 0) < CLAIM_MIN_MOMENTUM
      ) {
        return socket.emit("actionFailed", "Not enough Momentum.");
      }

      const action = new Action({ userId, skillKey, targetIds: {} });
      action.priority = 0;
      action.speed = user.Speed;
      action.turn = match.getCurrentTurn();
      action.momentumCost = 0;
      action.type = "claim";

      match.enqueueAction(action);

      io.to(socket.id).emit(
        "combatLog",
        `${formatChampionName(user)} prepared CLAIM. Action pending.`,
      );
      return;
    }

    if (!player || !user || user.team !== player.team) {
      return socket.emit(
        "actionFailed",
        "You are not allowed to use skills with this champion.",
      );
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) {
      return socket.emit("actionFailed", "Skill not found.");
    }

    if (!validateActionIntent(user, skill, socket)) return;

    // Only ultimates have a cost. Momentum is actually spent by the TurnResolver
    // when the action resolves, not here.
    let cost = 0;

    if (skill.isUltimate === true) {
      cost = user.getSkillCost(skill);

      if (!editMode.freeCostSkills && user.momentum < cost) {
        return socket.emit("actionFailed", "Not enough Momentum.");
      }
    }

    const action = new Action({ userId, skillKey, targetIds });
    action.priority = skill.priority || 0;
    action.speed = user.Speed;
    action.turn = match.getCurrentTurn();
    action.momentumCost = cost;

    match.enqueueAction(action);

    io.to(socket.id).emit(
      "combatLog",
      `${formatChampionName(user)} used ${skill.name}. Action pending.`,
    );
  });

  // =============================
  //  surrender
  // =============================

  socket.on("surrender", () => {
    if (match.isGameEnded()) return;

    const playerSlot = match.getSlotBySocket(socket.id);
    if (playerSlot === undefined) return;

    const player = match.players[playerSlot];
    if (!player) return;

    const surrenderingTeam = player.team;
    const winnerTeam = surrenderingTeam === 1 ? 2 : 1;
    const winnerSlot = winnerTeam - 1;
    const winnerName = match.players[winnerSlot]?.username;

    match.setWinnerScore(
      winnerSlot,
      match.combat.playerScores[winnerSlot] || 0,
    );
    match.combat.gameEnded = true; // mark game as ended on surrender

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
    });
  });

  // =============================
  //  endTurn
  // =============================

  socket.on("endTurn", () => {
    if (match.isGameEnded()) {
      socket.emit("actionFailed", "The game has already ended.");
      return;
    }

    const playerSlot = match.getSlotBySocket(socket.id);
    if (playerSlot === undefined) {
      socket.emit("actionFailed", "You are not in a valid player slot.");
      return;
    }

    match.addReadyPlayer(playerSlot);
    io.emit("playerConfirmedEndTurn", playerSlot);

    if (match.getReadyPlayersCount() === 2) {
      // Make sure both are still connected.
      if (!match.areBothPlayersConnected()) {
        match.clearTurnReadiness();
        socket.emit(
          "actionFailed",
          "Your opponent was disconnected. The turn was canceled.",
        );
        return;
      }
      handleEndTurn();
    } else {
      socket.emit(
        "waitingForOpponentEndTurn",
        "Waiting for the other player to confirm the end of the turn.",
      );
    }
  });
});

// ============================================================
//  SERVER STARTUP
// ============================================================

const configuredPort = Number(process.env.PORT);
const hasExplicitPort = Number.isInteger(configuredPort) && configuredPort > 0;
const initialPort = hasExplicitPort ? configuredPort : 3000;

function startServer(port) {
  httpServer.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !hasExplicitPort) {
      console.warn(`Port ${port} in use. Trying the next one...`);
      startServer(port + 1);
      return;
    }

    console.error("Failed to start the server:", error);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer(initialPort);
