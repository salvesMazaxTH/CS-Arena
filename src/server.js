// ============================================================
//  IMPORTS
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path, { format } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import livereload from "livereload";

const liveReloadServer = livereload.createServer();
liveReloadServer.watch("public");

import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { Player } from "../shared/engine/match/Player.js";

import { championDB } from "../shared/data/championDB.js";
import { Champion } from "../shared/core/Champion.js";
import { generateId } from "../shared/utils/id.js";
import {
  formatChampionName,
  formatPlayerName,
} from "../shared/ui/formatters.js";

import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";
import { Action } from "../shared/engine/combat/Action.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";

import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
} from "../shared/engine/combat/claim.js";

import { DamageEvent } from "../shared/engine/combat/DamageEvent.js";
import { snapshotChampions } from "../shared/engine/combat/snapshotChampions.js";
import { getHardCCActionDenial } from "../shared/core/championStatus.js";
import { decayShields } from "../shared/core/championCombat.js";
import {
  applyChampionTransformation,
  revertChampionTransformation,
} from "../shared/engine/match/championTransformation.js";

import { EMBLEMS } from "../shared/data/emblems/index.js";

// ============================================================
//  CONFIGURAÇÃO
// ============================================================

const editMode = {
  enabled: false,
  autoLogin: false,
  autoSelection: false, // Seleção automática de campeões (sem tela de seleção)
  actMultipleTimesPerTurn: false,
  unavailableChampions: false,
  damageOutput: null, // Valor fixo de dano para testes (ex: 999). null = desativado. (SERVER-ONLY)
  alwaysCrit: false, // Força crítico em todo ataque. (SERVER-ONLY)
  alwaysEvade: false, // Força evasão em todo ataque. (SERVER-ONLY)
  executionOverride: null, // null = normal
  // number = força threshold (ex: 1 = 100%, 0.5 = 50%)
  freeCostSkills: false, // Habilidades não consomem recurso. (SERVER-ONLY)
};

const TEAM_SIZE = 8;
const ACTIVE_PER_TEAM = 3; // máximo de campeões simultâneos em campo por time (roster=8, active=3)
const MAX_MATCH_TURNS = 20; // fim do jogo no final do turno 20
const CHAMPION_SELECTION_TIME = 120; // Segundos para seleção de campeões
const FIRST_CHOICE_TIMEOUT = 99999 * 1000; //30 * 1000; // 30s para escolha do 1v1 (99.999s para testes)
const DISCONNECT_TIMEOUT = 30 * 1000; // 30 s para reconexão

// ============================================================
//  SERVIDOR HTTP & EXPRESS
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
//  ESTADO DO JOGO
// ============================================================

const match = new GameMatch();
let waitingForAnimations = false;

function getChampionSpecies(champion) {
  if (!champion) return [];

  if (Array.isArray(champion.species)) {
    return champion.species
      .map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }

  if (typeof champion.speciesTag === "string") {
    return champion.speciesTag
      .replace(/^species\s*:\s*/i, "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function normalizeChampionClassKey(champion) {
  if (!champion) return null;

  const candidates = [
    champion.classKey,
    champion.classTag,
    champion.role,
    champion.archetype,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate
      .replace(/^class\s*:\s*/i, "")
      .trim()
      .toLowerCase();
    if (normalized) return normalized;
  }

  return null;
}

function evaluateEmblemEligibilityForRoster(emblem, rosterKeys = []) {
  if (!emblem || !emblem.requirements) return true;

  const requirements = emblem.requirements;
  const roster = rosterKeys.map((key) => championDB[key]).filter(Boolean);

  const checks = [];

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
    checks.push(actualCount >= requiredCount);
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
    const actualCount = roster.filter((champion) =>
      getChampionSpecies(champion).includes(targetSpecies),
    ).length;
    checks.push(actualCount >= requiredCount);
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
    const actualCount = roster.filter(
      (champion) => normalizeChampionClassKey(champion) === targetClass,
    ).length;
    checks.push(actualCount >= requiredCount);
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

    checks.push(actualCount >= requiredCount);
  }

  return checks.length === 0 || checks.every(Boolean);
}

/** Garante que a entrada do turno atual existe no histórico. */
function ensureTurnEntry() {
  return match.ensureTurnEntry();
}

/** Registra um evento no histórico do turno atual. */
function logTurnEvent(eventType, eventData) {
  match.logTurnEvent(eventType, eventData);
}

// ============================================================
//  SERIALIZAÇÃO DO ESTADO
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

/**
 * Champions that entered the field this turn and must stay concealed from the
 * opposing player until the turn is locked and resolution begins — knowing about
 * a reinforcement while actions are still being chosen is privileged information.
 *
 * Concealment lives in the payload rather than in the emit sites: any broadcast
 * that happens to fire mid-turn (a disconnect, an emblem sync, a debug reset)
 * would otherwise reveal them, which is why the leak had no obvious pattern.
 */
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

  // Garantir que campeões extras (ex: recém-mortos) estejam no payload se o frontend ainda os vir como ativos
  for (const extra of extraChampions) {
    if (extra && !champions.find((c) => c.id === extra.id)) {
      champions.push(extra.serialize());
    }
  }

  const visibleChampions = concealedSummonIds.size
    ? champions.filter((c) => !isConcealedFromViewer(c, viewerTeam))
    : champions;

  // Roster completo (8 campeões) de cada time, para exibição das lineup banners no cliente
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
//  GERENCIAMENTO DE CAMPEÕES
// ============================================================

/** Retorna uma chave aleatória de campeão, excluindo as fornecidas. */
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

function processChampionMutationRequest(
  {
    targetId,
    newChampionKey,
    mode = "swap",
    duration = 0,
    hpMode = "preserveRatio",
    statMode = "deltaFromBase",
    expectedToken = null,
  } = {},
  options = {},
) {
  const mutationContext = options?.context ?? null;

  if (mode === "restore") {
    const restored = match.combat.restoreInactive(targetId);
    return restored ? { champion: restored } : null;
  }

  if (mode === "transform") {
    const transformed = applyChampionTransformation({
      combat: match.combat,
      targetId,
      newChampionKey,
      currentTurn: match.combat.currentTurn,
      duration,
      hpMode,
      statMode,
    });

    if (!transformed) return null;

    const transformation = transformed.runtime?.transformation;
    if (transformation?.revertAtTurn && transformation?.token) {
      const scheduleFn = mutationContext?.schedule;
      const scheduledEffect = {
        type: "championMutation",
        turnToHappen: transformation.revertAtTurn,
        payload: {
          mode: "revertTransform",
          targetId: transformed.id,
          expectedToken: transformation.token,
        },
      };

      if (typeof scheduleFn === "function") {
        scheduleFn.call(mutationContext, scheduledEffect);
      } else {
        match.combat.scheduledEffects.push(scheduledEffect);
      }
    }

    return { champion: transformed };
  }

  if (mode === "revertTransform") {
    const reverted = revertChampionTransformation({
      combat: match.combat,
      targetId,
      expectedToken,
    });

    if (!reverted) return null;

    return {
      champion: reverted,
      log: `${formatChampionName(reverted)} retornou à sua forma original.`,
    };
  }

  const old = match.combat.getChampion(targetId);
  if (!old) return null;

  const swappedOut = match.combat.swapOut(targetId);
  if (!swappedOut) return null;

  const baseData = championDB[newChampionKey];
  if (!baseData)
    throw new Error(`ERRO: "${newChampionKey}" não encontrado em championDB.`);

  // Criar novo campeão com ID novo (nunca reusar targetId)
  const newId = generateId(newChampionKey);
  const newChampion = Champion.fromBaseData(baseData, newId, old.team, {
    combatSlot: old.combatSlot,
  });
  newChampion.championKey = newChampionKey;

  // Indica qual campeão este substituiu — lido pela passiva do substituto ao morrer
  newChampion.runtime.swappedFrom = targetId;

  match.combat.registerChampion(newChampion, { trackSnapshot: true });

  return { champion: newChampion };
}

/**
 * Creates, registers and (optionally) notifies the clients of a new champion.
 *
 * @param {Object}  opts
 * @param {string}  opts.championKey   – key in championDB
 * @param {number}  opts.team          – 1 or 2
 * @param {number|null}  [opts.combatSlot]  – explicit slot; when omitted, the next free one is used
 * @param {boolean} [opts.trackSnapshot=true]  – whether to record it in combatSnapshot (false during initial setup)
 * @param {boolean} [opts.emit=false]          – whether to emit "championAdded" to the clients
 * @returns {Champion|null} the created instance, or null when impossible (team full or invalid data)
 */
function spawnChampion({
  championKey,
  team,
  combatSlot = null,
  trackSnapshot = true,
  emitState = true,
  spawnProtection = true,
} = {}) {
  const baseData = championDB[championKey];
  if (!baseData) {
    console.warn(`[SPAWN] Aborted: "${championKey}" is not in the championDB.`);
    return null;
  }

  const entityType = baseData.entityType ?? "champion";

  // --- Check whether the team can take one more living champion ---
  // Minions go straight through: the field cap only counts champions.
  if (!match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM, { entityType })) {
    console.warn(
      `[SPAWN] Aborted: team ${team} already fields ${ACTIVE_PER_TEAM} champions (attempted: ${championKey}).`,
    );
    return null;
  }

  // --- Resolve combatSlot ---
  if (!Number.isInteger(combatSlot)) {
    combatSlot = match.combat.getNextAvailableSlot(team, ACTIVE_PER_TEAM, {
      entityType,
    });

    if (combatSlot === null) {
      console.warn(
        `[SPAWN] Aborted: no free slot on team ${team} (attempted: ${championKey}).`,
      );
      return null; // no free slot
    }
  } else if (match.combat.getChampionAtSlot(team, combatSlot)) {
    // The explicit slot (e.g. Jeff's revival) is already taken by another
    // entity — relocate instead of stacking two entities on the same spot.
    const fallbackSlot = match.combat.getNextAvailableSlot(
      team,
      ACTIVE_PER_TEAM,
      { entityType },
    );

    console.warn(
      `[SPAWN] Slot ${combatSlot} on team ${team} is taken; relocating ${championKey} to ${fallbackSlot}.`,
    );

    if (fallbackSlot === null) return null;
    combatSlot = fallbackSlot;
  }

  const id = generateId(championKey);

  const newChampion = Champion.fromBaseData(baseData, id, team, {
    combatSlot,
  });

  function applySeasonalSkin(champion) {
    const chance = 0.675;
    const roll = Math.random();

    if (roll > chance) return;

    const basePath = champion.portrait;

    const fileName = basePath.split("/").pop();
    if (!fileName) return;

    const baseName = fileName.replace(".webp", "");

    const winterPath = `/assets/portraits/${baseName}_curtindo_o_inverno.webp`;

    // Physical path on disk (adjust if needed).
    const absolutePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "portraits",
      `${baseName}_curtindo_o_inverno.webp`,
    );

    // 👇 only applied when the file actually exists
    if (fs.existsSync(absolutePath)) {
      champion.portrait = winterPath;
    }
  }

  applySeasonalSkin(newChampion);

  newChampion.championKey = championKey;
  /* console.log(
    `[SPAWN] ${newChampion.name} (ID: ${id}) on team ${team}, slot ${combatSlot}, with championKey ${championKey}`,
  ); */

  match.combat.registerChampion(newChampion, { trackSnapshot });

  emitCombatEvent(
    "onChampionAdded",
    {
      // Must NOT be named "owner": emitCombatEvent overwrites that key with the
      // hook's own owner (the champion on the champion path, the Player on the
      // emblem path), so emblem hooks could never see the champion being added.
      champion: newChampion,
      context: {
        currentTurn: match.combat.currentTurn,
        allChampions: match.combat.activeChampions,
        spawnProtection,
      },
      spawnProtection,
    },
    [newChampion],
    {
      players: match.players,
    },
  );

  if (!trackSnapshot) {
    // Initial setup — manual snapshot.
    match.combat.combatSnapshot.push({
      championKey,
      id,
      team,
      combatSlot: newChampion.combatSlot,
    });
  }

  if (emitState) {
    broadcastGameState();
  }

  return newChampion;
}

/** Instantiates and registers champions from a list of keys into a team (initial selection phase). */
/** Only the first ACTIVE_PER_TEAM take the field; the rest go to the reserve queue. */
function assignChampionsToTeam(team, championKeys) {
  championKeys.slice(0, ACTIVE_PER_TEAM).forEach((championKey, index) => {
    if (!championKey) return;
    spawnChampion({
      championKey,
      team,
      combatSlot: index,
      trackSnapshot: false,
      emit: false,
    });
  });
}

/** Inicializa a fila de reserva de um jogador (DESATIVADO). */
function initReserveQueue(_player) {
  // Sistema de reservas desativado para modo 3x3 fixo.
}

/**
 * Limpa momentum e todos os efeitos temporários de um campeão ao sair de campo por troca.
 * Modifiers com isPermanent=true (statModifiers) ou permanent=true (damageModifiers) são mantidos.
 */
function clearTemporaryEffectsOnSwitch(_champion) {
  // Sistema de switch desativado para modo 3x3 fixo.
}

// /** Emite backChampionUpdate com a fila completa de reserva do time. */
// function emitBackChampionUpdate(_team) {
//   // Sistema de reservas desativado para modo 3x3 fixo.
// }

/**
 * Spawna o próximo campeão da fila de reserva do time.
 *
 * @param {number} team
 * @param {object} [opts]
 * @param {'death'|'switch'} [opts.reason='death']  Por morte automática ou por troca manual.
 * @param {string|null}      [opts.championToSwitchOutId]  ID do campeão a substituir (apenas reason='switch').
 * @returns {Champion|null}
 */
// function spawnFromReserve(_team, _opts = {}) {
//   // Sistema de reservas desativado para modo 3x3 fixo.
//   return null;
// }

/** Verifica se ambos os jogadores selecionaram seus times e notifica os clientes. */
function checkAllTeamsSelected() {
  if (match.isTeamSelected(0) && match.isTeamSelected(1)) {
    io.emit("allTeamsSelected");
    broadcastGameState();
    return true;
  }
  return false;
}

/** Emite os sockets de morte de um campeão a partir do resultado de match.removeChampionFromGame(). */
function emitChampionDeath(deathResult) {
  if (!deathResult) return;

  const champ =
    match.combat.activeChampions.get(deathResult.championId) ||
    match.combat.deadChampions.get(deathResult.championId);

  console.log("[BACKEND][DEATH BEFORE EMIT]", {
    id: champ?.id,
    name: champ?.name,
    HP: champ?.HP,
    alive: champ?.alive,
    deathClaimTriggered: champ?.runtime?.deathClaimTriggered,
  });

  // Garantimos que o estado do campeão morto (com runtime atualizado) seja enviado
  // Limpar currentContext do campeão morto antes de serializar (evita referências circulares)
  if (champ?.runtime) delete champ.runtime.currentContext;

  const state = getGameState(champ ? [champ] : []);

  const deadChampInState = state.champions.find(
    (c) => c.id === deathResult.championId,
  );

  console.log("[BACKEND][GAMESTATE SNAPSHOT]", {
    found: !!deadChampInState,
    deathClaimTriggered: deadChampInState?.runtime?.deathClaimTriggered,
  });

  if (deathResult.scoreAwarded && deathResult.scorePayload) {
    io.emit("scoreUpdate", deathResult.scorePayload);
    io.emit("combatAction", {
      action: null,
      scorePayload: deathResult.scorePayload,
      claimPoints: null,
      globalDialogs: [],
      state,
      log: `${deathResult.championName ?? "Campeão"} foi eliminado. Pontuação atualizada.`,
    });
  }

  broadcastGameState(champ ? [champ] : []);
  io.emit("championRemoved", deathResult.championId);
}

// ============================================================
//  VALIDAÇÃO DE AÇÕES (pré-resolução)
// ============================================================

/**
 * Valida se o campeão pode SOLICITAR o uso de uma habilidade.
 * Chamada em "requestSkillUse" — rejeita imediatamente via socket.
 */
function validateActionIntent(user, skill, socket) {
  // console.log("[VALIDATE ACTION CALLED]", user?.name);
  if (!user.alive) {
    socket.emit("skillDenied", "Campeão morto.");
    return false;
  }

  const hardCCDenial = getHardCCActionDenial(user);
  if (hardCCDenial) {
    socket.emit("skillDenied", hardCCDenial.message);
    return false;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Já agiu neste turno.");
    return false;
  }

  return true;
}

// ============================================================
//  HELPERS DE MANIPULAÇÃO DE MOMENTUM
// ============================================================
/**
 * Aplica regeneração global de momentum (+12 unidades por turno)
 */
function applyGlobalMomentumRegen(champion, context, resolver) {
  if (!champion || !champion.alive) return 0;

  const GLOBAL_MOMENTUM_REGEN = 12; // +12 momentum por turno (equivalente a 3 unidades antigas)

  const applied = resolver
    ? resolver.applyResourceChange({
        target: champion,
        amount: GLOBAL_MOMENTUM_REGEN,
        context,
        sourceId: champion.id,
        visualPhase: "global_turn_regen",
        visualAfterHooks: true,
        debugLabel: "global_turn_regen",
      })
    : champion.addMomentum(GLOBAL_MOMENTUM_REGEN);

  /*   console.log(
    ` ${champion.name} regenerou ${applied} de Momentum no início do turno. Momentum atual: ${champion.momentum}/${champion.momentumMax}`,
  ); */

  // não retorna nada
}

//  EMISSÃO DE AÇÕES DE COMBATE (v2)
// ============================================================

/**
 * Extrai efeitos visuais ordenados a partir de um resultado do CombatResolver.
 * Retorna um array de efeitos que o cliente animará sequencialmente.
 */

function buildEmitTargetInfo(realTargetIds) {
  let targetName = null;

  if (realTargetIds.length === 1) {
    const champ =
      match.combat.activeChampions.get(realTargetIds[0]) ??
      match.combat.deadChampions.get(realTargetIds[0]);

    targetName = champ ? formatChampionName(champ) : null;
  } else if (realTargetIds.length > 1) {
    const names = realTargetIds.map((id) => {
      const champ =
        match.combat.activeChampions.get(id) ??
        match.combat.deadChampions.get(id);

      return champ ? formatChampionName(champ) : "Desconhecido";
    });

    const last = names.pop();
    targetName = `${names.join(", ")} e ${last}`;
  }

  return {
    targetId: realTargetIds[0] ?? null,
    targetName,
  };
}

function emitCombatEnvelopesFromContext({
  user,
  skill,
  context,
  scorePayload = null,
  claimPoints = null,
  log = null,
}) {
  const mainEnvelope = buildMainEnvelopeFromContext({
    user,
    skill,
    context,
  });

  /*   const reactionEnvelopes = buildReactionEnvelopesFromContext({
    user,
    skill,
    context,
  }); */

  if (mainEnvelope) {
    /* console.log(
      "SERVER SNAPSHOT ULT:",
      [...match.combat.activeChampions.values()].map((c) => ({
        name: c.name,
        momentum: c.momentum,
      })),
    );
    */
    const {
      damageEvents = [],
      healEvents = [],
      lifestealEvents = [],
      shieldEvents = [],
      buffEvents = [],
      resourceEvents = [],
      globalDialogs = [],
      redirectionEvents = [],
    } = mainEnvelope;

    const hasVisualChanges =
      damageEvents.length ||
      healEvents.length ||
      lifestealEvents.length ||
      shieldEvents.length ||
      buffEvents.length ||
      resourceEvents.length ||
      redirectionEvents.length ||
      globalDialogs.length;

    const shouldEmit =
      mainEnvelope.action || hasVisualChanges || !!scorePayload;

    if (shouldEmit) {
      /* console.log("[DEBUG] [JEFF REVIVAL DIALOG] === ENVELOPE SEND ===", {
        globalDialogs: context.visual.globalDialogs,
      }); */
      emitCombatAction({
        ...mainEnvelope,
        ...(log ? { log } : null),
        scorePayload,
        claimPoints,
      });
    }
  }

  /* for (const envelope of reactionEnvelopes) {
    emitCombatAction(envelope);
  } */
}

function buildMainEnvelopeFromContext({ user, skill, context }) {
  const {
    damageEvents = [],
    healEvents = [],
    lifestealEvents = [],
    shieldEvents = [],
    buffEvents = [],
    resourceEvents = [],
    globalDialogs = [],
    redirectionEvents = [],
  } = context.visual || {};

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  const mainDamage = damageEvents.filter((d) => (d.damageDepth ?? 0) === 0);
  const mainHeal = healEvents.filter((h) => (h.damageDepth ?? 0) === 0);
  const mainLifesteal = lifestealEvents.filter(
    (ls) => (ls.damageDepth ?? 0) === 0,
  );
  const mainShield = shieldEvents.filter((s) => (s.damageDepth ?? 0) === 0);
  const mainBuff = buffEvents.filter((b) => (b.damageDepth ?? 0) === 0);
  const mainResource = resourceEvents.filter((r) => (r.damageDepth ?? 0) === 0);

  // Coleta todos os alvos afetados (dano, cura, buff, shield)
  const allTargetIds = [...mainDamage, ...mainHeal, ...mainShield, ...mainBuff]
    .map((e) => e.targetId)
    .filter((id) => id && id !== userId);

  // Remove duplicatas
  const uniqueTargetIds = [...new Set(allTargetIds)];

  // Separa inimigos e aliados
  const userTeam = user?.team;
  const enemies = uniqueTargetIds.filter((id) => {
    const champ =
      match.combat.activeChampions.get(id) ??
      match.combat.deadChampions.get(id);
    return champ && userTeam !== undefined && champ.team !== userTeam;
  });
  const allies = uniqueTargetIds.filter((id) => {
    const champ =
      match.combat.activeChampions.get(id) ??
      match.combat.deadChampions.get(id);
    return champ && userTeam !== undefined && champ.team === userTeam;
  });

  // Regra: se houver inimigos, só mostra inimigos; senão, mostra aliados
  const realTargetIds = enemies.length > 0 ? enemies : allies;

  const { targetId, targetName } = buildEmitTargetInfo(realTargetIds);

  // Garante que cada damageEvent tenha skillKey para animação por hit
  const skillKey = skill?.key;
  const patchedDamage = mainDamage.map((ev) => ({ ...ev, skillKey }));

  return {
    action: user
      ? {
          userId,
          userName,
          skillKey: skillKey,
          skillName: skill?.name,
          targetId,
          targetName,
        }
      : null,
    damageEvents: patchedDamage,
    healEvents: mainHeal,
    lifestealEvents: mainLifesteal,
    shieldEvents: mainShield,
    buffEvents: mainBuff,
    resourceEvents: mainResource,
    redirectionEvents,

    globalDialogs,

    state: context._intermediateSnapshot,
  };
}

/**
 * Emite um envelope de ação de combate para todos os clientes.
 * Formato:
 *   action  — info sobre a skill usada (null para passivas/efeitos de turno)
 *   effects — array ordenado de efeitos a animar
 *   log     — texto verboso para o log de combate
 *   state   — snapshots do estado final dos campeões afetados
 */
function emitCombatAction(envelope) {
  if (!envelope) return;

  io.emit("combatAction", envelope);
}

function collectCombatLogs(value, logs = [], visited = new Set()) {
  if (value == null) return logs;

  if (typeof value === "string") {
    if (value.trim()) logs.push(value);
    return logs;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectCombatLogs(entry, logs, visited);
    }
    return logs;
  }

  if (typeof value !== "object") return logs;
  if (visited.has(value)) return logs;

  visited.add(value);

  if (typeof value.log === "string" && value.log.trim()) {
    logs.push(value.log);
  }

  if (typeof value.logMessage === "string" && value.logMessage.trim()) {
    logs.push(value.logMessage);
  }

  const nestedLogCollections = [
    "results",
    "beforeLogs",
    "afterLogs",
    "passiveLogs",
    "extraResults",
    "globalDialogs",
    "dialogs",
  ];

  for (const key of nestedLogCollections) {
    const nestedValue = value[key];
    if (Array.isArray(nestedValue)) {
      collectCombatLogs(nestedValue, logs, visited);
    }
  }

  return logs;
}

function emitCombatLogsFromResults(results = []) {
  if (!Array.isArray(results) || results.length === 0) return;

  for (const log of collectCombatLogs(results)) {
    io.emit("combatLog", log);
  }
}

// ============================================================
//  RESOLUÇÃO DE TURNOS
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

  // 1. Resolver todas as ações via TurnResolver (switches têm prioridade 6 — saem primeiro)
  const resolver = new TurnResolver(match, editMode, {
    mutationHandler: (request, meta = {}) =>
      processChampionMutationRequest(request, {
        context: meta.context ?? null,
      }),
  });
  const { actionResults, deathResults } = resolver.resolveTurn();

  // 2. Processamento de switch/substituição desativado (modo 3x3 fixo).

  // 3. Coletar todos os championMutationRequests ANTES de emitir envelopes
  const allChampionMutationRequests = [];

  // 4. Emitir envelopes para cada resultado
  for (const result of actionResults) {
    if (result.executed) {
      const actionLog = collectCombatLogs(result.results).join("\n");

      emitCombatEnvelopesFromContext({
        user: result.user,
        skill: result.skill,
        context: result.context,
        scorePayload: result.scorePayload ?? null,
        claimPoints: result.claimPoints ?? null,
        log: actionLog || null,
      });

      // Coletar championMutationRequests mas NÃO processar ainda
      // (será feito após deathResults para evitar que a nova criatura seja marcada como morta)
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

  // 5. Emitir mortes
  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  // 6. AGORA processar championMutationRequests (após deathResults)
  // Assim evitamos que a nova criatura seja registrada como morta
  if (allChampionMutationRequests.length > 0) {
    for (const req of allChampionMutationRequests) {
      processChampionMutationRequest(req);
    }

    broadcastGameState();
  }

  // 4. Hooks onTurnEnd
  const context = {
    currentTurn: match.combat.currentTurn,
    activeChampions: Array.from(match.combat.activeChampions.values()).filter(
      (c) => c.alive,
    ),
  };

  emitCombatEvent("onTurnEnd", { context }, match.combat.activeChampions);

  // 5. Limpeza de turno e avanço
  match.clearActions();
  match.clearTurnReadiness();
  match.clearFinishedAnimationSockets();
  match.clearTurnSummons();

  // Checar fim de jogo (roster wipe, limite de turnos ou threshold de
  // pontuação) somente após todas as demais tarefas de fim de turno.
  emitGameOverIfNeeded({ checkTurnLimit: true });

  if (!match.isGameEnded()) {
    match.nextTurn();
  }

  // 6. Sinaliza clientes que todos os eventos de combate foram emitidos
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
      const result = processChampionMutationRequest(effect.payload);
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

/** Aplica regeneração global de HP/MP/Energy no início do turno. */
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

  // 1. Injetar contexto
  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    decayShields(champ, currentTurn);
  });

  // 3. Hooks onTurnStart (DoTs, passivas reativas, etc.)
  // Skip turn 1 hooks — no previous effects to process on the first turn
  let turnStartResults = [];
  if (currentTurn > 1) {
    turnStartResults = emitCombatEvent(
      "onTurnStart",
      { context: turnStartContext },
      match.combat.activeChampions,
    );

    emitCombatLogsFromResults(turnStartResults);
  }

  // 4. Executar scheduled effects deste turno (inclusive os agendados durante onTurnStart)
  const remaining = [];

  for (const effect of match.combat.scheduledEffects) {
    if (effect.turnToHappen === currentTurn) {
      handleScheduledEffect(effect, turnStartContext);
      if (effect.dialog) {
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

  // 3. Limpar expirados
  match.combat.activeChampions.forEach((champion) => {
    champion.purgeExpiredStatModifiers(match.combat.currentTurn);
    champion.purgeExpiredStatusEffects(match.combat.currentTurn);
    champion.purgeExpiredHookEffects(match.combat.currentTurn);
  });

  // 5. Regen global
  match.combat.activeChampions.forEach((champion) => {
    const applied = applyGlobalMomentumRegen(
      champion,
      turnStartContext,
      resolver,
    );
  });

  // 6. Limpar runtime context
  match.combat.activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  // 🔹 7. Emit envelope (novo modelo)
  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "turn_start", name: "Início do Turno" },
    context: turnStartContext,
  });

  io.emit("turnUpdate", match.combat.currentTurn);
  broadcastGameState();
}

// ============================================================
//  RESET DO ESTADO DO JOGO
// ============================================================

/** Reseta completamente o estado do jogo (todos desconectados ou timeout). */
function resetGameState() {
  revealConcealedSummons();
  match.clearPlayers();
}

/** Reseta o estado de combate (HP, buffs, ult, etc.) mantendo os campeões e jogadores (debug/test only). */
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

  // console.log("[DEBUG] Combat state reset.");
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);
  console.log("Total de usuários conectados:", io.engine.clientsCount);

  // Envia editMode IMEDIATAMENTE ao client SEM propriedades server-only (damageOutput, alwaysCrit, etc.)
  const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
  socket.emit("editModeUpdate", clientEditMode);

  // --- Socket handler para reset de combate (debug) ---
  socket.on("debugResetCombat", () => {
    resetCombatState();
    broadcastGameState();
  });

  // --- Socket handler para início de turno após animações ---
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

  // --- Helpers internos à conexão ---

  /** Atribui um slot de jogador e notifica o cliente. */
  function assignPlayerSlot(username) {
    // Se este socket já possui um slot, não criar outro (evita duplicação por autoLogin + clique manual)
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
      socket.emit(
        "serverFull",
        "O servidor está cheio. Tente novamente mais tarde.",
      );
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
    // io.emit("switchesUpdate", {
    //   team1: match.players[0]?.remainingSwitches ?? 0,
    //   team2: match.players[1]?.remainingSwitches ?? 0,
    // });

    return { playerSlot: slot, finalUsername };
  }

  /** Inicia a seleção de campeões para jogadores pendentes. */
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

  /** Seleção automática (editMode) ou delega para seleção manual. */
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

    // Aguarda segundo jogador
    if (!match.areBothPlayersConnected()) {
      socket.emit(
        "waitingForOpponent",
        `Hello, ${finalUsername}, waiting for the other player...`,
      );
      return;
    }

    io.emit("allPlayersConnected");

    // Seleção de campeões
    if (editMode.enabled && editMode.autoSelection) {
      handleEditModeSelection();
    } else {
      handleChampionSelection();
    }

    // Reconexão — cancela timer e notifica oponente
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

    // Popula a fila de reserva de cada time com o roster confirmado
    // e inicia a fase de escolha do primeiro campeão (1v1 inicial).
    match.players.forEach((player) => {
      if (!player) return;
      match.combat.reserveQueues.set(player.team, [
        ...player.selectedChampionKeys,
      ]);
    });

    startFirstChampionChoicePhase();
  }

  /** Inicia a fase de escolha do primeiro campeão (1v1). */
  function startFirstChampionChoicePhase() {
    match.players.forEach((player) => {
      if (!player) return;

      const team = match.getPlayerTeam(player.socketId);
      const roster = match.combat.reserveQueues.get(team) || [];

      io.to(player.socketId).emit("requestFirstChampionSelection", {
        roster,
        timeout: FIRST_CHOICE_TIMEOUT,
      });

      // Agenda o timeout para escolha automática
      const timeoutId = setTimeout(() => {
        // Se o jogador ainda não escolheu, escolhe automaticamente
        if (!match.combat.firstChampionChoices.has(player.socketId)) {
          console.log(
            `[TIMEOUT] Jogador ${player.username} não escolheu. Selecionando automaticamente.`,
          );
          const autoSelectedChampion = roster[0]; // Pega o primeiro da lista
          if (autoSelectedChampion) {
            handleFirstChampionChoice(player.socketId, autoSelectedChampion);
          }
        }
      }, FIRST_CHOICE_TIMEOUT);

      match.setFirstChoiceTimer(player.socketId, timeoutId);
    });
  }

  /** Processa a escolha do primeiro campeão de um jogador. */
  function handleFirstChampionChoice(socketId, championKey) {
    const player = match.getPlayerBySocketId(socketId);
    if (!player) return;

    // Limpa o timeout e registra a escolha no GameMatch
    const alreadyChosen = !match.setFirstChampionChoice(socketId, championKey);
    if (alreadyChosen) return;

    console.log(
      `Jogador ${player.username} escolheu ${formatChampionName(
        championDB[championKey],
      )} para o 1v1.`,
    );

    // Verifica se ambos já escolheram
    if (match.combat.firstChampionChoices.size === 2) {
      handleAllFirstChampionsChosen();
    }
  }

  /** Quando ambos os jogadores escolheram seu campeão inicial. */
  function handleAllFirstChampionsChosen() {
    // Previne execuções múltiplas
    if (match.combat.activeChampions.size > 0) return;

    console.log("Ambos os jogadores escolheram. Iniciando o 1v1.");

    // Finaliza a fase de escolha no GameMatch (spawna, atualiza reservas)
    const { choices } = match.finalizeFirstChampionChoices(spawnChampion);

    io.emit("firstChampionChoicesFinalized", { choices });
    broadcastGameState();

    // Inicia o primeiro turno
    setTimeout(() => {
      handleStartTurn();
      io.emit("turnStart", {
        turn: match.combat.currentTurn,
        activeChampions: Array.from(match.combat.activeChampions.keys()),
      });
    }, 1000); // Pequeno delay para UI
  }

  // =============================
  //  disconnect
  // =============================

  socket.on("disconnect", () => {
    let disconnectedSlot = match.getSlotBySocket(socket.id);

    if (disconnectedSlot === undefined) {
      // fallback: procura no array players
      disconnectedSlot = match.players.findIndex(
        (player) => player && player.socketId === socket.id,
      );
    }

    if (disconnectedSlot === -1 || disconnectedSlot === undefined) {
      console.warn("Disconnect de socket não mapeado:", socket.id);
      return;
    }

    const wasGameActive = match.areBothPlayersConnected();

    // Limpa timers pendentes
    match.clearDisconnectionTimer(disconnectedSlot);
    match.clearSelectionTimer(disconnectedSlot);

    // Libera slot
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

    // Nenhum jogador restante — reset total
    if (connectedCount === 0) {
      resetGameState();
      broadcastGameState();
      return;
    }

    // Um jogador restante com jogo ativo — inicia contagem regressiva
    if (wasGameActive && connectedCount === 1) {
      // console.log("PLAYERS:", match.players);
      // console.log("CONNECTED COUNT:", connectedCount);
      const remainingSlot = match.players[0] ? 0 : 1;
      const remainingSocketId = match.players[remainingSlot].socketId;

      io.to(remainingSocketId).emit("opponentDisconnected", {
        timeout: DISCONNECT_TIMEOUT,
      });

      const timer = setTimeout(() => {
        io.to(remainingSocketId).emit(
          "forceLogout",
          "Seu oponente se desconectou e não reconectou a tempo.",
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
      return socket.emit("actionFailed", "Você não está em uma partida ativa.");
    }

    const selectedKeys = Array.isArray(emblems) ? emblems : [];
    const validKeys = selectedKeys.filter((key) =>
      EMBLEMS.some((emblem) => emblem.key === key),
    );

    if (validKeys.length > 2) {
      return socket.emit(
        "actionFailed",
        "Você pode selecionar no máximo 2 Emblems ativos.",
      );
    }

    // Antes da equipe ser confirmada, selectedChampionKeys ainda está vazio no
    // servidor. Usamos o roster provisório enviado pelo cliente (draft em
    // andamento) para essa checagem; a validação final e definitiva acontece
    // de novo no handler de "selectTeam" contra a lineup realmente confirmada.
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
      (emblem) => !evaluateEmblemEligibilityForRoster(emblem, rosterKeys),
    );

    if (invalidForRoster) {
      return socket.emit(
        "actionFailed",
        `Este Emblem não é elegível para a sua lineup atual: ${invalidForRoster.name}.`,
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
          "Você não tem permissão para selecionar campeões para este time.",
        );
        return;
      }

      if (player.isTeamSelected()) {
        socket.emit("actionFailed", "Você já confirmou sua equipe.");
        return;
      }

      // Validação server-authoritative: rejeita keys inválidas
      const invalidKey = selectedChampionKeys.find((key) => {
        const data = championDB[key];
        return !isChampionSelectableInDraft(data);
      });

      if (invalidKey) {
        socket.emit(
          "actionFailed",
          `Campeão inválido na seleção: ${invalidKey}`,
        );
        return;
      }

      player.setSelectedChampionKeys(selectedChampionKeys);

      const invalidEmblem = player.emblems.find(
        (emblem) =>
          !evaluateEmblemEligibilityForRoster(emblem, selectedChampionKeys),
      );

      if (invalidEmblem) {
        socket.emit(
          "actionFailed",
          `Sua seleção de Emblems não é válida para a lineup final: ${invalidEmblem.name}.`,
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

    logTurnEvent("championSummoned", {
      championId: spawned.id,
      championKey,
      team,
    });
  });

  socket.on("requestSkillUse", ({ userId, skillKey, targetId }) => {
    const user = match.combat.activeChampions.get(userId);
    if (!user) return socket.emit("skillDenied", "Sem permissão.");

    if (skillKey === CLAIM_ACTION_KEY) {
      if (!validateActionIntent(user, null, socket)) return;

      if (
        !editMode.freeCostSkills &&
        (Number(user.momentum) || 0) < CLAIM_MIN_MOMENTUM
      ) {
        return socket.emit("skillDenied", `Momentum insuficiente.`);
      }

      return socket.emit("skillApproved", { userId, skillKey });
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) return socket.emit("skillDenied", "Skill inválida.");

    if (!validateActionIntent(user, skill, socket)) return;

    if (!skill.isUltimate) {
      return socket.emit("skillApproved", { userId, skillKey });
    }

    const cost = user.getSkillCost(skill);

    if (!editMode.freeCostSkills && cost > user.momentum) {
      return socket.emit("skillDenied", `Momentum insuficiente.`);
    }

    socket.emit("skillApproved", { userId, skillKey });
  });

  // =============================
  //  requestUndoActions (cancela ações pendentes do time do jogador)
  // =============================
  socket.on("requestUndoActions", () => {
    const playerSlot = match.getSlotBySocket(socket.id);

    if (playerSlot === undefined) return;

    const playerTeam = playerSlot + 1;

    // console.log("[UNDO] Player team:", playerTeam);

    for (let i = match.combat.pendingActions.length - 1; i >= 0; i--) {
      // Se não tem nada no array, sair do loop
      if (!match.combat.pendingActions.length) {
        console.warn("Pedido de undo sem ações pendentes.");
        break; // SAI DO LOOP, mas continua a execução da função abaixo do loop
      }
      const action = match.combat.pendingActions[i];
      const champ = match.combat.activeChampions.get(action.userId);

      if (!champ) continue;

      if (champ.team !== playerTeam) continue;

      // reverter estado
      champ.hasActedThisTurn = false;

      if (action.momentumCost > 0) {
        champ.addMomentum({ amount: action.momentumCost });
      }

      match.combat.pendingActions.splice(i, 1);
    }

    // 🔥 remover confirmação de fim de turno
    if (match.isPlayerReady(playerSlot)) {
      match.removeReadyPlayer(playerSlot);
      io.emit("playerCanceledEndTurn", playerSlot);
    }

    socket.emit("actionsCanceled");
  });

  // =============================
  //  useSkill (enfileira ação pendente)
  // =============================

  socket.on("useSkill", ({ userId, skillKey, targetIds }) => {
    /* console.log("[USE SKILL] Recebido pedido de uso de skill:", {
      userId,
      skillKey,
      targetIds,
    });
    */
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    const user = match.combat.activeChampions.get(userId);

    if (skillKey === CLAIM_ACTION_KEY) {
      if (!player || !user || user.team !== player.team) {
        return socket.emit(
          "actionFailed",
          "Você não tem permissão para usar CLAIM com este campeão.",
        );
      }

      if (!validateActionIntent(user, null, socket)) return;

      if (
        !editMode.freeCostSkills &&
        (Number(user.momentum) || 0) < CLAIM_MIN_MOMENTUM
      ) {
        return socket.emit("actionFailed", "Momentum insuficiente.");
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
        `${formatChampionName(user)} preparou CLAIM. Ação pendente.`,
      );
      return;
    }

    if (!player || !user || user.team !== player.team) {
      return socket.emit(
        "actionFailed",
        "Você não tem permissão para usar habilidades com este campeão.",
      );
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) {
      return socket.emit("actionFailed", "Habilidade não encontrada.");
    }

    if (!validateActionIntent(user, skill, socket)) return;

    // 🔥 Apenas ultimates têm custo
    let cost = 0;

    if (skill.isUltimate === true) {
      cost = user.getSkillCost(skill);

      if (!editMode.freeCostSkills && user.momentum < cost) {
        return socket.emit("actionFailed", "Momentum insuficiente.");
      }

      //if (!editMode.freeCostSkills) {
      // user.spendMomentum(cost);
      // a lógica de consumo/gasto de recurso (Momentum) foi movida para responsabilidade da TurnResolver na execução da ação da skill respectiva.
      //}
    }

    const action = new Action({ userId, skillKey, targetIds });
    action.priority = skill.priority || 0;
    action.speed = user.Speed;
    action.turn = match.getCurrentTurn();
    action.momentumCost = cost;

    match.enqueueAction(action);

    // console.log("[PENDING ACTION ADDED]", match.combat.pendingActions);

    io.to(socket.id).emit(
      "combatLog",
      `${formatChampionName(user)} usou ${skill.name}. Ação pendente.`,
    );
  });

  // =============================
  //  surrender (Render-se)
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
      socket.emit("actionFailed", "O jogo já terminou.");
      return;
    }

    const playerSlot = match.getSlotBySocket(socket.id);
    if (playerSlot === undefined) {
      socket.emit(
        "actionFailed",
        "Você não está em um slot de jogador válido.",
      );
      return;
    }

    match.addReadyPlayer(playerSlot);
    io.emit("playerConfirmedEndTurn", playerSlot);

    if (match.getReadyPlayersCount() === 2) {
      // Valida se ambos ainda estão conectados
      if (!match.areBothPlayersConnected()) {
        match.clearTurnReadiness();
        socket.emit(
          "actionFailed",
          "Seu oponente foi desconectado. O turno foi cancelado.",
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
//  INICIALIZAÇÃO DO SERVIDOR
// ============================================================

const configuredPort = Number(process.env.PORT);
const hasExplicitPort = Number.isInteger(configuredPort) && configuredPort > 0;
const initialPort = hasExplicitPort ? configuredPort : 3000;

function startServer(port) {
  httpServer.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !hasExplicitPort) {
      console.warn(`Porta ${port} em uso. Tentando a próxima...`);
      startServer(port + 1);
      return;
    }

    console.error("Falha ao iniciar o servidor:", error);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

startServer(initialPort);
