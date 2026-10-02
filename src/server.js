// ============================================================
//  IMPORTS
// ============================================================

import "../shared/data/champions/promoteScheduledReleases.js";

import "dotenv/config";
import express from "express";
import compression from "compression";
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
import { STAR_SCORE_THRESHOLD } from "../shared/engine/match/matchRules.js";

import { championDB } from "../shared/data/championDB.js";
import { getDuoForCore } from "../shared/data/duos.js";
import { SpawnProtection } from "../shared/engine/combat/spawnProtection.js";
import { Nothingness } from "../shared/engine/combat/nothingness.js";
import { rosterChampionKey } from "../shared/engine/match/championTransformation.js";
import { formatChampionName } from "../shared/ui/formatters.js";

import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";
import { Action } from "../shared/engine/combat/Action.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";
import { CombatEnvelopeBuilder } from "../shared/engine/combat/CombatEnvelopeBuilder.js";

import { CLAIM_ACTION_KEY } from "../shared/engine/combat/claim.js";

import { DamageEvent } from "../shared/engine/combat/DamageEvent.js";
import { getHardCCActionDenial } from "../shared/core/championStatus.js";
import { decayShields } from "../shared/core/championCombat.js";

import { EMBLEMS } from "../shared/data/emblems/index.js";
import {
  PREBUILT_TEAMS,
  validateTeamComposition,
} from "../shared/data/teams/index.js";
import { isEditModeClean, recordMatchResult } from "./analytics/supabaseAnalytics.js";
import { getPlayerFromToken } from "./auth/verifyToken.js";

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
  unrestrictedSummon: false, // Summon line-up champions from turn 1 and more than once per turn (field cap still applies).
  summonWithoutSpawnProtection: false, // Line-up summons enter with no spawn protection at all.
  everyTurnIsStarCheckpoint: false, // Every turn end awards the checkpoint star, not only the scheduled turns.
};

const TEAM_SIZE = 8;
const ACTIVE_PER_TEAM = 3; // max champions on the field per team (roster=8, active=3)
const FIRST_CHOICE_TIMEOUT = 45 * 1000; // 45s for the 1v1 pick before auto-selecting at random
const DISCONNECT_TIMEOUT = 50 * 1000; // 50s to reconnect
const ANIMATION_STRAGGLER_TIMEOUT = 45 * 1000; // 45s for the second client to finish animating a turn

// ============================================================
//  HTTP SERVER & EXPRESS
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// On Render the files only change on redeploy (which restarts the server), so a
// day of caching is safe there; locally we keep serving fresh files.
const staticOpts = process.env.RENDER
  ? {
      maxAge: "1d",
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }
  : {};

app.use(compression());
app.use(express.static(path.join(__dirname, "..", "public"), staticOpts));
app.use("/shared", express.static(path.join(__dirname, "..", "shared"), staticOpts));

// Public Supabase settings for the browser (the anon key is meant to be public).
app.get("/config.js", (_req, res) => {
  res.type("application/javascript").set("Cache-Control", "no-cache");
  res.send(
    `window.CSA_CONFIG = ${JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    })};`,
  );
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ============================================================
//  GAME STATE
// ============================================================

const match = new GameMatch();
const envelopeBuilder = new CombatEnvelopeBuilder(match.combat);
let waitingForAnimations = false;
let animationStragglerTimer = null;
let gameOverEmitted = false;

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
/** The champions that actually arrive when `championKey` is summoned. */
function resolveSummonGroup(championKey) {
  return getDuoForCore(championKey)?.cores ?? [championKey];
}

function getLineupSummonAvailability(team) {
  if (
    !editMode.unrestrictedSummon &&
    (match.getCurrentTurn() === 1 || match.hasSummonedThisTurn(team))
  ) {
    return { canSummon: false, champions: [] };
  }

  const reserve = match.combat.reserveQueues.get(team) || [];

  const champions = reserve.filter((championKey) => {
    const baseData = championDB[championKey];
    if (!baseData) return false;

    const entering = resolveSummonGroup(championKey);
    if (!entering.every((key) => reserve.includes(key))) return false;

    return match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM, {
      entityType: baseData.entityType ?? "champion",
      requiredSlots: entering.length,
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
 * Rewrites serialized entities for viewers outside their own team, following the
 * `runtime.disguise` bag each one declares: `fields` overrides serialized values,
 * `mirrorFields` copies them from the entity named by `mirrorFrom`, and
 * `hideRuntimeKeys` strips runtime entries that would give the disguise away.
 * The bag itself never reaches any client.
 */
function applyDisguises(champions, viewerTeam) {
  if (!champions.some((entry) => entry?.runtime?.disguise)) return champions;

  const byId = new Map(champions.map((entry) => [entry.id, entry]));

  return champions.map((serialized) => {
    const disguise = serialized.runtime?.disguise;
    if (!disguise) return serialized;

    const runtime = { ...serialized.runtime };
    delete runtime.disguise;

    if (viewerTeam === serialized.team) return { ...serialized, runtime };

    for (const key of disguise.hideRuntimeKeys ?? []) delete runtime[key];

    const mirrored = {};
    const source = byId.get(disguise.mirrorFrom);
    if (source) {
      for (const key of disguise.mirrorFields ?? []) mirrored[key] = source[key];
    }

    return { ...serialized, ...mirrored, ...(disguise.fields ?? {}), runtime };
  });
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

  const disguised = applyDisguises(champions, viewerTeam);

  const visibleChampions = concealedSummonIds.size
    ? disguised.filter((c) => !isConcealedFromViewer(c, viewerTeam))
    : disguised;

  // Full 8-champion roster of each team, for the client's line-up banners.
  const lineups = {};
  const playerEmblems = {};
  const lineupSummons = {};
  const lineupStatus = {};
  for (const player of match.players) {
    if (!player) continue;
    lineups[player.team] = player.selectedChampionKeys || [];
    lineupSummons[player.team] = getLineupSummonAvailability(player.team);
    lineupStatus[player.team] = getLineupStatuses(player.team, viewerTeam);
    playerEmblems[player.team] = getVisibleEmblemKeys(player, viewerTeam);
  }

  return {
    champions: visibleChampions,
    currentTurn: match.combat.currentTurn,
    lineups,
    playerEmblems,
    lineupSummons,
    lineupStatus,
  };
}

/**
 * The emblems of a player this viewer may know about: all of them for their own
 * team, otherwise only those that already acted. An emblem first triggered by a
 * champion still concealed waits for that champion's reveal.
 */
function getVisibleEmblemKeys(player, viewerTeam) {
  const keys = player.emblems.map((emblem) => emblem.key);
  if (viewerTeam != null && viewerTeam === player.team) return keys;

  return keys.filter((key) => {
    if (!player.revealedEmblems.has(key)) return false;
    return !concealedSummonIds.has(player.revealedEmblems.get(key));
  });
}

/** Where each of a team's line-up champions stands, as this viewer may see it. */
function getLineupStatuses(team, viewerTeam) {
  const statuses = {};

  for (const championKey of match.combat.reserveQueues.get(team) || []) {
    statuses[championKey] = "reserve";
  }

  for (const champion of match.combat.deadChampions.values()) {
    if (champion.team === team) statuses[rosterChampionKey(champion)] = "dead";
  }

  for (const champion of match.combat.inactiveChampions.values()) {
    if (champion.team !== team) continue;

    statuses[rosterChampionKey(champion)] = Nothingness.isVanished(champion)
      ? "nothingness"
      : "field";
  }

  for (const champion of match.combat.activeChampions.values()) {
    if (champion.team !== team) continue;

    // A concealed summon must still read as untouched reserve to the opponent.
    statuses[rosterChampionKey(champion)] = isConcealedFromViewer(champion, viewerTeam)
      ? "reserve"
      : "field";
  }

  return statuses;
}

/** Team of the player behind a socket, or null when the socket is not playing. */
function getViewerTeam(socketId) {
  const slot = match.getSlotBySocket(socketId);
  if (slot === undefined) return null;
  return match.getPlayer(slot)?.team ?? null;
}

/** Rewrites the champion payload embedded in an envelope, in either shape it
 *  takes: a bare snapshot array, or a full getGameState object. A bare snapshot
 *  draws whoever the client does not know yet, so a concealed summon leaves it. */
function disguiseState(state, viewerTeam) {
  if (Array.isArray(state)) {
    return applyDisguises(state, viewerTeam).filter(
      (champion) => !isConcealedFromViewer(champion, viewerTeam),
    );
  }

  if (Array.isArray(state?.champions)) {
    return { ...state, champions: applyDisguises(state.champions, viewerTeam) };
  }

  return state;
}

// Every event group whose entries carry a targetState.
const VISUAL_EVENT_KEYS = [
  "damageEvents",
  "healEvents",
  "lifestealEvents",
  "shieldEvents",
  "buffEvents",
  "resourceEvents",
];

/** Rewrites the per-event visual states an envelope carries, so a disguise is
 *  hidden there exactly as it is in the envelope's own snapshot. */
function disguiseEventStates(envelope, viewerTeam) {
  const patch = {};

  for (const key of VISUAL_EVENT_KEYS) {
    const events = envelope[key];
    if (!Array.isArray(events) || !events.length) continue;

    const states = applyDisguises(
      events.map((event) => event.targetState),
      viewerTeam,
    );

    patch[key] = events.map((event, index) => ({
      ...event,
      targetState: states[index],
    }));
  }

  return patch;
}

/**
 * Emits a combatAction, tailoring the champion state it carries to each viewer.
 * Use this instead of io.emit("combatAction", ...): the envelope embeds full
 * serializations, so a broadcast would hand every disguise straight to the
 * opposing player.
 */
function emitCombatAction(envelope) {
  for (const [socketId, socket] of io.sockets.sockets) {
    const viewerTeam = getViewerTeam(socketId);

    socket.emit("combatAction", {
      ...envelope,
      ...disguiseEventStates(envelope, viewerTeam),
      state: disguiseState(envelope.state, viewerTeam),
    });
  }
}

/**
 * Sends the game state to every connected socket, tailored to what that viewer
 * is allowed to know. Use this instead of io.emit("gameStateUpdate", ...) so a
 * concealed summon or an emblem that has not acted yet can never leak through
 * an unrelated broadcast. Always per viewer: each side knows only its own
 * emblems in full.
 */
function broadcastGameState(extraChampions = []) {
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

/** Emblem keys → the emblem objects the combat engine runs hooks off. */
function resolveEmblems(keys = []) {
  return keys
    .map((key) => EMBLEMS.find((emblem) => emblem.key === key))
    .filter(Boolean);
}

const PORTRAITS_DIR = path.join(process.cwd(), "public", "assets", "portraits");

function portraitBaseName(champion) {
  return champion.portrait.split("/").pop().replace(".webp", "");
}

/** Winter portrait for this champion when the roll hits and the asset exists; else null. */
function rollSeasonalSkin(champion) {
  if (Math.random() > 0.675) return null;

  const skinFile = `${portraitBaseName(champion)}_curtindo_o_inverno.webp`;
  return fs.existsSync(path.join(PORTRAITS_DIR, skinFile))
    ? `/assets/portraits/${skinFile}`
    : null;
}

/** A random hand-authored alt portrait for this champion when the roll hits; else null. */
function rollAltSkin(champion) {
  if (Math.random() > 0.35) return null;

  const baseName = portraitBaseName(champion);
  const altSkins = [];
  for (let index = 1; ; index += 1) {
    const skinFile = `${baseName}_alt_skin_${index}.webp`;
    if (!fs.existsSync(path.join(PORTRAITS_DIR, skinFile))) break;
    altSkins.push(skinFile);
  }
  if (altSkins.length === 0) return null;

  return `/assets/portraits/${altSkins[Math.floor(Math.random() * altSkins.length)]}`;
}

/** Server-only cosmetic portrait swap on spawn; a coin flip settles it when both skins roll in. */
function applyCosmeticSkin(champion) {
  const seasonal = rollSeasonalSkin(champion);
  const alt = rollAltSkin(champion);

  const chosen =
    seasonal && alt ? (Math.random() < 0.5 ? seasonal : alt) : seasonal ?? alt;
  if (chosen) champion.portrait = chosen;
}

/**
 * Spawns a champion through the combat model (which enforces the field cap and
 * fires onChampionAdded), applies the server-only cosmetic skins, and — when
 * emitState — broadcasts the new state. Returns the instance, or null when it
 * could not be spawned.
 */
function spawnChampion({ emitState = true, ...spawnOpts } = {}) {
  const champion = match.combat.spawnChampion(spawnOpts);
  if (!champion) return null;

  applyCosmeticSkin(champion);
  if (emitState) {
    broadcastGameState();
    flushFieldArrivals();
  }

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
    emitCombatAction({
      action: null,
      scorePayload: deathResult.scorePayload,
      claimPoints: null,
      globalDialogs: [],
      state: getGameState(champ ? [champ] : []),
      log: `${deathResult.championName ?? "Champion"} was eliminated. Score updated.`,
    });
  }

  broadcastGameState(champ ? [champ] : []);

  // Sent on the event rather than read off runtime: the flag is stripped from
  // the payload of anything wearing a disguise.
  io.emit("championRemoved", {
    championId: deathResult.championId,
    leavesNoDeath: champ?.runtime?.leavesNoDeath === true,
    unmakingVfx: champ?.runtime?.unmakingVfx ?? null,
  });
}

// Held until the envelopes are out, or a champion leaves the DOM before the
// animation of the blow that took it away gets to play.
const pendingFieldDepartures = [];

// Held until the state that draws their portrait has reached the client: an
// entrance cannot be animated on an element that does not exist yet.
const pendingFieldArrivals = [];

/**
 * Collects the entrance of everyone that reached the field naming one. Whoever
 * puts a champion there writes runtime.arrivalVfx, which is consumed here so
 * the entrance plays once however the champion got in.
 */
function collectFieldArrivals(drawnIds = null) {
  // A mid-turn snapshot is looked up by id: whoever it drew may already have
  // died later in the same resolution and left activeChampions, yet its
  // entrance still has to play before the blow that took it away.
  const candidates = drawnIds
    ? [...drawnIds].map((id) => match.combat.getChampion(id))
    : match.combat.activeChampions.values();

  for (const champion of candidates) {
    const arrivalVfx = champion?.runtime?.arrivalVfx;
    if (!arrivalVfx) continue;

    delete champion.runtime.arrivalVfx;
    pendingFieldArrivals.push({ championId: champion.id, arrivalVfx });
  }
}

/**
 * Emits the queued entrances. Only ever call it after a state broadcast, or
 * pass the ids of the snapshot that has just drawn them.
 */
function flushFieldArrivals(drawnIds = null) {
  collectFieldArrivals(drawnIds);

  while (pendingFieldArrivals.length) {
    io.emit("championArrived", pendingFieldArrivals.shift());
  }
}

/** Applies a champion mutation, queueing the field exit of anyone it takes away. */
function applyChampionMutation(request, options = {}) {
  const result = match.combat.mutateChampion(request, options);

  if (request?.mode === "summon" && result?.champion) {
    applyCosmeticSkin(result.champion);
  }

  if (request?.mode === "vanish" && result?.champion) {
    pendingFieldDepartures.push({
      championId: result.champion.id,
      leavesNoDeath: true,
      unmakingVfx: result.champion.runtime?.unmakingVfx ?? null,
    });
  }

  return result;
}

/** Emits the queued field exits of champions that left without dying. */
function flushFieldDepartures() {
  while (pendingFieldDepartures.length) {
    io.emit("championRemoved", pendingFieldDepartures.shift());
  }
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

  // Only the acting champion's own hook sources are consulted, so a denial can
  // never become information the opponent reads off the declaration.
  const intentResults = emitCombatEvent(
    "onValidateActionIntent",
    { actionSource: user, skill },
    [user],
    { players: match.players },
  );

  for (const res of intentResults) {
    if (res?.deny) {
      socket.emit("skillDenied", res.message || "This action is unavailable.");
      return false;
    }
  }

  return true;
}

// ============================================================
//  COMBAT ACTION EMISSION (v2)
// ============================================================

/** Builds the action envelope via CombatEnvelopeBuilder and emits it if it has content. */
function emitCombatEnvelopesFromContext(params) {
  const envelope = envelopeBuilder.buildActionEnvelope(params);
  if (envelope) emitCombatAction(envelope);
}

function emitCombatLogsFromResults(results = []) {
  if (!Array.isArray(results) || results.length === 0) return;

  for (const log of envelopeBuilder.collectLogs(results)) {
    io.emit("combatLog", log);
  }
}

/** Each entry may be a plain string or a { en, pt } pair, so this must stay
 *  unjoined — only the client, which knows the viewer's locale, may flatten
 *  it into a single string. */
function logsOrNull(results) {
  const logs = envelopeBuilder.collectLogs(results);
  return logs.length ? logs : null;
}

// ============================================================
//  TURN RESOLUTION
// ============================================================

/** Every champion ever summoned by either team this match, dead or swapped out included, serialized for the end-of-match stats panel. */
function getMatchRosterStats() {
  const roster = [
    ...match.combat.getTeamChampions(1, { includeInactive: true, includeDead: true }),
    ...match.combat.getTeamChampions(2, { includeInactive: true, includeDead: true }),
  ];

  for (const champion of roster) {
    if (champion.runtime) delete champion.runtime.currentContext;
  }

  return roster.map((champion) => champion.serialize());
}

/** One analytics row per form each champion took, so a transformation scores
 *  under its own key while the drafted form keeps what it did itself. */
function getMatchFormStats() {
  const roster = [
    ...match.combat.getTeamChampions(1, { includeInactive: true, includeDead: true }),
    ...match.combat.getTeamChampions(2, { includeInactive: true, includeDead: true }),
  ];

  return roster.flatMap((champion) => {
    const draftedKey = rosterChampionKey(champion);
    return champion.getMatchStatsByForm().map(({ championKey, matchStats }) => ({
      team: champion.team,
      championKey,
      formOf: championKey === draftedKey ? null : draftedKey,
      matchStats,
    }));
  });
}

function uploadMatchResult(winnerTeam) {
  if (!isEditModeClean(editMode)) return;

  recordMatchResult({
    winnerTeam,
    turnCount: match.combat.currentTurn,
    scores: match.combat.playerScores,
    players: match.players.map((p) => ({
      team: p.team,
      username: p.username,
      userId: p.userId,
      championKeys: p.selectedChampionKeys,
      emblemKeys: p.emblems.map((e) => e.key),
    })),
    formStats: getMatchFormStats(),
  }).catch((err) => console.error("[analytics] upload falhou:", err));
}

function emitGameOverIfNeeded({ endOfTurn = false } = {}) {
  const gameEnd = match.checkGameEnd({ endOfTurn });

  if (!gameEnd.ended) return;

  // The end-turn resolution and the start-of-turn hooks both run this; the
  // client hears about the win once.
  if (gameOverEmitted) return;
  gameOverEmitted = true;

  const winnerSlot = gameEnd.winnerSlot;
  const winnerTeam = winnerSlot != null ? winnerSlot + 1 : null;
  const winnerName =
    winnerSlot != null ? match.players[winnerSlot]?.username : null;
  const championRoster = getMatchRosterStats();

  io.emit("gameOver", { winnerTeam, winnerName, champions: championRoster });

  uploadMatchResult(winnerTeam);
}

function handleEndTurn() {
  // The server becomes authoritative about the phase before notifying clients.
  // Summons received after this point belong to the next planning window and
  // must not mutate the field while the current turn is being resolved.
  if (match.combat.phase !== "planning") return;
  match.combat.phase = "resolving";
  waitingForAnimations = true;

  io.emit("turnLocked");

  // Nobody can act any more, so this is the moment the line-up summons made
  // during the turn become public — right before their actions are resolved.
  revealConcealedSummons();
  broadcastGameState();

  // Resolve every action through the TurnResolver.
  const resolver = new TurnResolver(match, editMode, {
    mutationHandler: (request, meta = {}) =>
      applyChampionMutation(request, { context: meta.context ?? null }),
  });
  const { actionResults, deathResults, deathContext, lockContext } =
    resolver.resolveTurn();

  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "actions_locked", name: "Turn Lock" },
    context: lockContext,
    log: logsOrNull(lockContext.registeredResults),
  });

  // Collect all championMutationRequests BEFORE emitting envelopes; they are
  // processed after deathResults so the new creature is never flagged as dead.
  const allChampionMutationRequests = [];

  for (const result of actionResults) {
    if (result.executed) {
      emitCombatEnvelopesFromContext({
        user: result.user,
        skill: result.skill,
        context: result.context,
        scorePayload: result.scorePayload ?? null,
        claimPoints: result.claimPoints ?? null,
        log: logsOrNull(result.results),
      });

      // A mid-turn summon is drawn by this envelope's snapshot, so its
      // entrance plays right after the action that brought it in.
      const drawn = result.context?._intermediateSnapshot;
      if (drawn) flushFieldArrivals(new Set(drawn.map(({ id }) => id)));

      // Whoever slipped into the Nothingness during this action leaves right
      // after it, not after the whole turn has played out.
      flushFieldDepartures();

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

      emitCombatAction({
        globalDialogs,
        state: result.context?._intermediateSnapshot ?? null,
      });
    } else if (result.logMessage) {
      io.emit("combatLog", result.logMessage);
    }
  }

  flushFieldDepartures();

  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "champion_death", name: "Champion Death" },
    context: deathContext,
    scorePayload: resolver.applyScoreResults(deathContext.registeredResults),
    log: logsOrNull(deathContext.registeredResults),
  });

  // Now process championMutationRequests (after deathResults) so the new
  // creature is not registered as dead.
  if (allChampionMutationRequests.length > 0) {
    for (const req of allChampionMutationRequests) {
      applyChampionMutation(req);
    }

    flushFieldDepartures();
    broadcastGameState();
    flushFieldArrivals();
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

  emitTurnEndStars(resolver);

  // Check game end (roster wipe or stars) only after every other end-of-turn
  // task.
  emitGameOverIfNeeded({ endOfTurn: true });

  if (!match.isGameEnded()) {
    match.nextTurn();
  }

  // Signal clients that every combat event has been emitted.
  io.emit("combatPhaseComplete");
}

/** Awards the end-of-turn stars and announces them through the animation queue. */
function emitTurnEndStars(resolver) {
  const { thresholdSlots, checkpointSlots } =
    match.combat.awardTurnEndStars({
      everyTurnIsCheckpoint: !!editMode.everyTurnIsStarCheckpoint,
    });
  if (!thresholdSlots.length && !checkpointSlots.length) return;

  const context = resolver.createBaseContext({ sourceId: null });
  const messages = [
    ...thresholdSlots.map((slot) => {
      const name = match.players[slot]?.username ?? `Player ${slot + 1}`;
      return {
        en: `<b>${name}</b> reached <b>${STAR_SCORE_THRESHOLD}</b> points first and earns a <b>star</b>!`,
        pt: `<b>${name}</b> chegou primeiro a <b>${STAR_SCORE_THRESHOLD}</b> pontos e ganha uma <b>estrela</b>!`,
      };
    }),
    ...checkpointSlots.map((slot) => {
      const name = match.players[slot]?.username ?? `Player ${slot + 1}`;
      return {
        en: `<b>${name}</b> leads on points at the end of turn <b>${match.combat.currentTurn}</b> and earns a <b>star</b>!`,
        pt: `<b>${name}</b> lidera nos pontos ao fim do turno <b>${match.combat.currentTurn}</b> e ganha uma <b>estrela</b>!`,
      };
    }),
  ];
  for (const message of messages) {
    context.registerDialog({ message, sourceId: null, targetId: null });
  }

  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "star_award", name: "Star" },
    context,
    scorePayload: match.getScorePayload(),
    log: messages,
  });
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
        // onSpawn is what names the entrance, so the state that draws the
        // portrait can only go out after it has run.
        emitState: false,
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

      broadcastGameState();
      flushFieldArrivals();
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
      const result = applyChampionMutation(effect.payload);
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

function cancelAnimationStragglerWatch() {
  clearTimeout(animationStragglerTimer);
  animationStragglerTimer = null;
}

/** Ends the wait for the resolved turn's animations and starts the next turn. */
function finishAnimationWait() {
  cancelAnimationStragglerWatch();
  waitingForAnimations = false;
  match.clearFinishedAnimationSockets();
  handleStartTurn();
}

/** Runs start-of-turn processing: scheduled effects, hooks, purges and global regen. */
function handleStartTurn() {
  match.combat.phase = "starting";
  const currentTurn = match.combat.currentTurn;

  // Flip the client's turn header before any start-of-turn log or animation is
  // emitted, so DoT ticks and scheduled detonations group under the new turn.
  io.emit("turnUpdate", currentTurn);

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

  // Purge expired effects.
  match.combat.activeChampions.forEach((champion) => {
    SpawnProtection.clear(champion);
    champion.purgeExpiredStatModifiers(match.combat.currentTurn);
    champion.purgeExpiredStatusEffects(
      match.combat.currentTurn,
      turnStartContext,
    );
    champion.purgeExpiredHookEffects(match.combat.currentTurn);
  });

  // Global momentum regen.
  match.combat.activeChampions.forEach((champion) => {
    resolver.applyGlobalMomentumRegen(champion, turnStartContext);
  });

  // After the purge, or the sweep would strip the arrival state they land with.
  for (const recalled of Nothingness.processDueReturns(
    match.combat,
    turnStartContext,
  )) {
    turnStartContext.registerDialog({
      message: recalled.log,
      sourceId: recalled.champion.id,
      targetId: recalled.champion.id,
    });
  }

  // Clear the runtime context.
  match.combat.activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "turn_start", name: "Turn Start" },
    context: turnStartContext,
    scorePayload: resolver.applyScoreResults(turnStartContext.registeredResults),
    log: logsOrNull(turnStartContext.registeredResults),
  });

  flushFieldDepartures();

  // The removal must reach the client after the envelope, or the champion
  // leaves the DOM before its own damage animation gets to play.
  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  // Start-of-turn hooks (e.g. Jeff's Inevitabilidade da Morte) can kill the
  // last real champion outside the regular end-turn action flow.
  emitGameOverIfNeeded();

  // This is the only point at which a new planning window becomes available.
  // Set it before broadcasting so the client state and server validation agree.
  // A finished match must never reopen its planning window.
  match.combat.phase = match.isGameEnded() ? "ended" : "planning";
  broadcastGameState();
  flushFieldArrivals();
}

// ============================================================
//  GAME STATE RESET
// ============================================================

/** Fully resets the game state (everyone disconnected or timed out). */
function resetGameState() {
  revealConcealedSummons();
  match.clearPlayers();
  waitingForAnimations = false;
  cancelAnimationStragglerWatch();
  gameOverEmitted = false;
}

/** Empties the field and rebuilds each reserve from its roster (debug/test only). */
function resetCombatState() {
  revealConcealedSummons();
  pendingFieldDepartures.length = 0;
  pendingFieldArrivals.length = 0;
  match.combat.reset();
  match.combat.start();

  for (const player of match.players) {
    if (!player) continue;

    match.combat.reserveQueues.set(player.team, [
      ...player.selectedChampionKeys,
    ]);
  }

  waitingForAnimations = false;
  cancelAnimationStragglerWatch();
  gameOverEmitted = false;
}

/**
 * Withdraws a team's pending actions, refunding their momentum, and drops the
 * team's end-of-turn confirmation.
 */
function cancelTeamPendingActions(playerSlot) {
  const playerTeam = playerSlot + 1;

  for (let i = match.combat.pendingActions.length - 1; i >= 0; i--) {
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

  if (match.isPlayerReady(playerSlot)) {
    match.removeReadyPlayer(playerSlot);
    io.emit("playerCanceledEndTurn", playerSlot);
  }
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

// Every connection carries a Supabase access token; the account behind it, not
// anything the client types, decides who the player is. editMode.autoLogin is
// the development shortcut that skips this.
io.use(async (socket, next) => {
  if (editMode.enabled && editMode.autoLogin) return next();

  const player = await getPlayerFromToken(socket.handshake.auth?.token);
  if (!player) return next(new Error("unauthorized"));

  socket.data.userId = player.userId;
  socket.data.displayName = player.displayName;
  next();
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  console.log("Total connected users:", io.engine.clientsCount);

  // Send editMode to the client immediately, WITHOUT server-only fields (damageOutput, alwaysCrit, etc.).
  const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
  socket.emit("editModeUpdate", clientEditMode);

  // Combat reset (debug).
  socket.on("debugResetCombat", () => {
    if (!editMode.enabled) return;

    resetCombatState();

    io.emit("combatReset", {
      turn: match.getCurrentTurn(),
      score: match.getScorePayload(),
    });

    broadcastGameState();
    startFirstChampionChoicePhase();
  });

  // Start of turn, once animations finish on both clients.
  socket.on("combatAnimationsFinished", () => {
    if (!waitingForAnimations) return;
    if (match.getSlotBySocket(socket.id) === undefined) return;

    match.addFinishedAnimationSocket(socket.id);

    if (match.getFinishedAnimationCount() >= 2) {
      finishAnimationWait();
      return;
    }

    // A client that never reports back would hold the match forever with no
    // error anywhere, so the one that did waits a bounded time for it.
    if (animationStragglerTimer) return;

    const reporterSlot = match.getSlotBySocket(socket.id);

    animationStragglerTimer = setTimeout(() => {
      animationStragglerTimer = null;
      if (!waitingForAnimations) return;

      const stragglerSlot = reporterSlot === 0 ? 1 : 0;
      const straggler = match.getPlayer(stragglerSlot)?.username ?? "?";
      console.warn(
        `[watchdog] Player ${stragglerSlot + 1} (${straggler}) never reported the end of the turn's animations; moving on without them.`,
      );

      finishAnimationWait();
    }, ANIMATION_STRAGGLER_TIMEOUT);
  });

  // A phone's console is out of reach mid-match, so client-side failures are
  // echoed to this terminal.
  socket.on("clientError", (report) => {
    const slot = match.getSlotBySocket(socket.id);
    const who =
      slot === undefined
        ? `socket ${socket.id}`
        : `Player ${slot + 1} (${match.getPlayer(slot)?.username ?? "?"})`;
    const message = String(report?.message ?? "").slice(0, 500);
    const stack = String(report?.stack ?? "").slice(0, 2000);

    console.error(`[client] ${who}: ${message}${stack ? `\n${stack}` : ""}`);
  });

  // --- Connection-scoped helpers ---

  /** Assigns a player slot and notifies the client. */
  function assignPlayerSlot() {
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
    const finalUsername = socket.data.displayName ?? `Player${slot + 1}`;

    // The same account can't hold both slots by opening two tabs.
    const userId = socket.data.userId ?? null;
    if (
      userId &&
      !editMode.enabled &&
      match.players.some((p) => p?.userId === userId)
    ) {
      socket.emit("alreadyConnected", "This account is already in the arena.");
      socket.disconnect();
      return null;
    }

    const player = new Player({
      id: playerId,
      team,
      username: finalUsername,
      userId,
    });

    player.setSocket(socket.id);
    player.clearChampionSelection();

    match.setPlayer(slot, player);

    match.assignSocketToSlot(socket.id, slot);

    socket.emit("playerAssigned", {
      playerId,
      team,
      username: finalUsername,
      emblems: player.emblems.map((emblem) => emblem.key),
    });
    io.emit("playerCountUpdate", match.getConnectedCount());
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
    socket.emit(
      "gameStateUpdate",
      getGameState([], { viewerTeam: getViewerTeam(socket.id) }),
    );

    return { playerSlot: slot, finalUsername };
  }

  /** editMode shortcut: ready every pending player with the first prebuilt team. */
  function autoReadyEditMode() {
    const team = PREBUILT_TEAMS[0];
    if (!team) return;

    for (const player of match.players) {
      if (!player || player.isTeamSelected()) continue;
      player.setSelectedChampionKeys([...team.champions]);
      player.setEmblems(resolveEmblems(team.emblems));
    }

    if (checkAllTeamsSelected()) startGameIfReady();
  }

  // =============================
  //  requestPlayerSlot
  // =============================

  /**
   * Puts a returning account back into the slot it held, mid-match, and sends
   * its client everything it needs to pick up exactly where it left off.
   */
  function resumeMatch(slot) {
    const player = match.rebindPlayerSocket(slot, socket.id);
    if (!player) return;

    match.clearDisconnectionTimer(slot);

    console.log(`Player ${slot + 1} (${player.username}) reconnected.`);

    socket.emit("playerAssigned", {
      playerId: player.id,
      team: player.team,
      username: player.username,
      emblems: player.emblems.map((emblem) => emblem.key),
    });
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
    io.emit("playerCountUpdate", match.getConnectedCount());

    const firstChoicePending =
      match.combat.activeChampions.size === 0 &&
      !match.combat.firstChampionChoices.has(socket.id);

    socket.emit("matchResumed", {
      turn: match.getCurrentTurn(),
      score: match.getScorePayload(),
      phase: match.combat.phase,
      roster: player.selectedChampionKeys,
      firstChoicePending,
    });
    socket.emit(
      "gameStateUpdate",
      getGameState([], { viewerTeam: getViewerTeam(socket.id) }),
    );

    if (firstChoicePending) {
      socket.emit("requestFirstChampionSelection", {
        roster: match.combat.reserveQueues.get(player.team) || [],
        timeout: FIRST_CHOICE_TIMEOUT,
      });
    } else if (
      match.combat.phase === "planning" &&
      match.combat.activeChampions.size > 0
    ) {
      socket.emit("turnUpdate", match.combat.currentTurn);
    }

    const opponent = match.getOpponent(slot);
    if (opponent && !opponent.disconnected) {
      io.to(opponent.socketId).emit("opponentReconnected");
    }

    // The returning client has no turn animations left to play.
    if (waitingForAnimations) {
      match.addFinishedAnimationSocket(socket.id);
      if (match.getFinishedAnimationCount() >= 2) finishAnimationWait();
    }
  }

  socket.on("requestPlayerSlot", () => {
    const heldSlot = match.findHeldSlotForUser(socket.data.userId);

    if (heldSlot !== -1) {
      if (!match.isGameEnded() && !gameOverEmitted) {
        resumeMatch(heldSlot);
        return;
      }
      // The match ended while this account was away; nothing to go back to.
      match.clearDisconnectionTimer(heldSlot);
      match.setPlayer(heldSlot, null);
    }

    const assignResult = assignPlayerSlot();
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

    // Each player picks a saved team on the hub and emits "readyWithTeam".
    if (editMode.enabled && editMode.autoSelection) {
      autoReadyEditMode();
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

    // Both players just locked in fresh teams, so any combat still flagged as
    // started belongs to an abandoned match that never got a full reset (it only
    // happens when the slots empty out one at a time and the count never reaches
    // zero). Wipe it, otherwise the old state would be restored instead.
    if (match.isCombatStarted()) match.combat.reset();

    // A match that ended without the slots ever emptying (surrender, or the
    // players leaving one at a time) leaves this flag set, and the new match's
    // win would then never reach the clients.
    gameOverEmitted = false;

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

    const leavingPlayer = match.getPlayer(disconnectedSlot);

    // Mid-match, an account keeps its slot through the reconnection window, so
    // reloading the page drops it straight back into the match.
    if (
      wasGameActive &&
      leavingPlayer?.userId &&
      match.isCombatStarted() &&
      !match.isGameEnded() &&
      !gameOverEmitted
    ) {
      leavingPlayer.disconnected = true;
      match.removeSocket(socket.id);
      cancelTeamPendingActions(disconnectedSlot);

      io.emit("playerCountUpdate", match.getConnectedCount());
      io.emit("playerNamesUpdate", match.getPlayerNamesEntries());

      const remainingSlot = disconnectedSlot === 0 ? 1 : 0;
      const remainingSocketId = match.getPlayer(remainingSlot).socketId;

      io.to(remainingSocketId).emit("opponentDisconnected", {
        timeout: DISCONNECT_TIMEOUT,
      });

      const timer = setTimeout(() => {
        io.to(remainingSocketId).emit(
          "forceLogout",
          "Your opponent disconnected and did not reconnect in time.",
        );

        resetGameState();
        io.emit("playerCountUpdate", match.getConnectedCount());
        io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
        broadcastGameState();
      }, DISCONNECT_TIMEOUT);

      match.setDisconnectionTimer(disconnectedSlot, timer);
      return;
    }

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
  //  readyWithTeam (hub → matchmaking)
  // =============================

  socket.on("readyWithTeam", ({ champions, emblems } = {}) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];

    if (!player) {
      return socket.emit(
        "readyWithTeamRejected",
        "You are not in an active match.",
      );
    }
    if (player.isTeamSelected()) {
      return socket.emit(
        "readyWithTeamRejected",
        "You have already locked in a team.",
      );
    }

    const team = {
      champions: Array.isArray(champions) ? champions : [],
      emblems: Array.isArray(emblems) ? emblems : [],
    };
    const check = validateTeamComposition(team, {
      championDB,
      emblems: EMBLEMS,
      editMode,
    });

    if (!check.ok) {
      return socket.emit("readyWithTeamRejected", check.errors[0]);
    }

    player.setSelectedChampionKeys([...team.champions]);
    player.setEmblems(resolveEmblems(team.emblems));

    broadcastGameState();
    startGameIfReady();
  });

  socket.on("cancelReadyWithTeam", () => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    if (!player || match.isCombatStarted()) return;

    player.clearChampionSelection();
    player.setEmblems([]);
    broadcastGameState();
  });

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

    if (match.isGameEnded() || match.combat.phase !== "planning") {
      return socket.emit(
        "actionFailed",
        match.isGameEnded()
          ? "The combat has already ended."
          : "You cannot summon while the turn is being resolved.",
      );
    }

    const team = player.team;

    if (!editMode.unrestrictedSummon) {
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
    }

    const reserve = match.combat.reserveQueues.get(team) || [];
    const entering = championKey ? resolveSummonGroup(championKey) : [];

    if (!entering.length || !entering.every((key) => reserve.includes(key))) {
      return socket.emit(
        "actionFailed",
        "That champion is not available to be summoned.",
      );
    }

    // The champion cap binds line-up summons only; every type counts toward the entity cap.
    const summonEntityType = championDB[championKey].entityType ?? "champion";

    if (
      !match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM, {
        entityType: summonEntityType,
        requiredSlots: entering.length,
      })
    ) {
      return socket.emit(
        "actionFailed",
        entering.length > 1
          ? `${getDuoForCore(championKey).name} enter together and need ${entering.length} free spaces on the battlefield.`
          : "There is no free space on the battlefield to summon more champions.",
      );
    }

    const spawnedGroup = entering.map((key) =>
      spawnChampion({
        championKey: key,
        team,
        trackSnapshot: true,
        emitState: false,
        spawnProtection: !editMode.summonWithoutSpawnProtection,
      }),
    );

    if (spawnedGroup.some((spawned) => !spawned)) {
      return socket.emit("actionFailed", "This champion could not be summoned.");
    }

    match.combat.reserveQueues.set(
      team,
      reserve.filter((key) => !entering.includes(key)),
    );
    match.markSummonedThisTurn(team);

    // The opponent is still choosing actions, so this reinforcement stays hidden
    // from them until the turn locks and resolution begins.
    spawnedGroup.forEach((spawned) => concealedSummonIds.add(spawned.id));

    // Emitted only after the bookkeeping above, so the payload's summon
    // availability already reflects this summon.
    broadcastGameState();

    spawnedGroup.forEach((spawned) =>
      match.logTurnEvent("championSummoned", {
        championId: spawned.id,
        championKey: spawned.championKey,
        team,
      }),
    );
  });

  socket.on("requestSkillUse", ({ userId, skillKey, targetId }) => {
    const user = match.combat.activeChampions.get(userId);
    if (!user) return socket.emit("skillDenied", "Not allowed.");

    if (skillKey === CLAIM_ACTION_KEY) {
      if (!validateActionIntent(user, null, socket)) return;

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

    cancelTeamPendingActions(playerSlot);

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
    gameOverEmitted = true;

    const championRoster = getMatchRosterStats();

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
      champions: championRoster,
    });

    uploadMatchResult(winnerTeam);
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
