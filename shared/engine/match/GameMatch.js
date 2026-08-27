import { getClaimMaxPoints } from "../combat/claim.js";
import { championDB } from "../../data/championDB.js";
import { getDuoForCore } from "../../data/duos.js";
import { Champion } from "../../core/Champion.js";
import { generateId } from "../../utils/id.js";
import { emitCombatEvent } from "../combat/combatEvents.js";
import { formatChampionName } from "../../ui/formatters.js";
import {
  applyChampionTransformation,
  revertChampionTransformation,
} from "./championTransformation.js";

// Sanity ceiling for the minion slot search. Minions have no rule-level cap;
// this only keeps the lookup from running away if something goes wrong.
const MAX_MINION_SLOTS = 24;

class LobbyState {
  constructor(match) {
    this.match = match;
    this.socketToSlot = new Map();
    this.selectionTimers = [null, null];
    this.disconnectionTimers = new Map();
    this.firstChoiceTimeouts = new Map();
  }

  assignSocketToSlot(socketId, slot) {
    this.socketToSlot.set(socketId, slot);

    const player = this.match.getPlayer(slot);
    if (player) {
      player.setSocket(socketId);
    }
  }

  getSlotBySocket(socketId) {
    return this.socketToSlot.get(socketId);
  }

  removeSocket(socketId) {
    this.socketToSlot.delete(socketId);
  }

  setSelectionTimer(slot, timerId) {
    this.clearSelectionTimer(slot);
    this.selectionTimers[slot] = timerId;
  }

  clearSelectionTimer(slot) {
    const timer = this.selectionTimers[slot];
    if (!timer) return;
    clearTimeout(timer);
    this.selectionTimers[slot] = null;
  }

  clearAllSelectionTimers() {
    for (let slot = 0; slot < this.selectionTimers.length; slot++) {
      this.clearSelectionTimer(slot);
    }
  }

  setDisconnectionTimer(slot, timerId) {
    this.clearDisconnectionTimer(slot);
    this.disconnectionTimers.set(slot, timerId);
  }

  getDisconnectionTimer(slot) {
    return this.disconnectionTimers.get(slot);
  }

  clearDisconnectionTimer(slot) {
    const timer = this.disconnectionTimers.get(slot);
    if (!timer) return;
    clearTimeout(timer);
    this.disconnectionTimers.delete(slot);
  }

  clearAllDisconnectionTimers() {
    for (const [slot] of this.disconnectionTimers) {
      this.clearDisconnectionTimer(slot);
    }
  }

  setFirstChoiceTimer(socketId, timerId) {
    this.clearFirstChoiceTimer(socketId);
    this.firstChoiceTimeouts.set(socketId, timerId);
  }

  clearFirstChoiceTimer(socketId) {
    const timer = this.firstChoiceTimeouts.get(socketId);
    if (!timer) return;
    clearTimeout(timer);
    this.firstChoiceTimeouts.delete(socketId);
  }

  clearAllFirstChoiceTimers() {
    this.firstChoiceTimeouts.forEach((timer) => clearTimeout(timer));
    this.firstChoiceTimeouts.clear();
  }

  reset() {
    this.socketToSlot.clear();
    this.clearAllSelectionTimers();
    this.clearAllDisconnectionTimers();
    this.clearAllFirstChoiceTimers();
  }
}

class CombatState {
  constructor(match) {
    this.match = match;
    this.reset();
  }

  reset() {
    this.currentTurn = 1;
    this.pendingActions = [];
    this.activeChampions = new Map();
    this.deadChampions = new Map();
    this.inactiveChampions = new Map(); // Champions already materialized and swapped out but can return (e.g., Lana when Tutu enters field)
    this.reserveQueues = new Map(); // Fila de reserva por time (unmaterialized roster/lineup)
    this.playerScores = [0, 0]; // score system enabled
    this.gameEnded = false;
    this.started = false;
    this.playersReadyToEndTurn = new Set();
    this.finishedAnimationSockets = new Set();
    this.combatSnapshot = [];
    this.turnHistory = new Map();
    this.scheduledEffects = [];

    this.firstChampionChoices = new Map(); // Escolha inicial para o 1v1
    this.summonedThisTurn = new Set(); // Times que já invocaram um campeão da line-up neste turno
  }

  resetProgress() {
    this.pendingActions = [];
    this.currentTurn = 1;
    this.playersReadyToEndTurn.clear();
    this.finishedAnimationSockets.clear();
    this.turnHistory.clear();
    this.scheduledEffects = [];
    this.playerScores = [0, 0]; // reset progress also clears score counters
    this.gameEnded = false;
    this.reserveQueues.clear();
    this.firstChampionChoices.clear();
    this.summonedThisTurn.clear();
  }

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
  }

  ensureTurnEntry() {
    if (!this.turnHistory.has(this.currentTurn)) {
      this.turnHistory.set(this.currentTurn, {
        events: [],
        championsDeadThisTurn: [],
        skillsUsedThisTurn: {},
        damageDealtThisTurn: {},
      });
    }

    return this.turnHistory.get(this.currentTurn);
  }

  logTurnEvent(eventType, eventData) {
    const turnData = this.ensureTurnEntry();
    turnData.events.push({
      type: eventType,
      ...eventData,
      timestamp: Date.now(),
    });
  }

  getChampion(championId) {
    return (
      this.activeChampions.get(championId) ||
      this.inactiveChampions.get(championId) ||
      this.deadChampions.get(championId) ||
      null
    );
  }

  /**
   * Move a champion from active to inactive (e.g., Lana swapping out for Tutu).
   * Used when a player swaps out one champion for another while both remain "alive" in the match.
   */
  swapOut(championId) {
    const champion = this.activeChampions.get(championId);
    if (!champion) return null;

    this.activeChampions.delete(championId);
    this.inactiveChampions.set(championId, champion);
    return champion;
  }

  /**
   * Move a champion from inactive back to active (e.g., Lana returning when Tutu dies).
   * Used to restore a previously swapped-out champion.
   */
  restoreInactive(championId) {
    const champion = this.inactiveChampions.get(championId);
    if (!champion) return null;

    this.inactiveChampions.delete(championId);
    this.activeChampions.set(championId, champion);
    return champion;
  }

  getTeamChampions(
    team,
    { alive = false, includeInactive = false, includeDead = false } = {},
  ) {
    const champions = [
      ...this.activeChampions.values(),
      ...(includeInactive ? this.inactiveChampions.values() : []),
      ...(includeDead ? this.deadChampions.values() : []),
    ];

    return champions.filter(
      (champion) => champion.team === team && (!alive || champion.alive),
    );
  }

  getLivingRosterCount(team) {
    const active = [...this.activeChampions.values()].filter(
      (champion) => champion.team === team && champion.alive,
    ).length;

    const inactive = [...this.inactiveChampions.values()].filter(
      (champion) => champion.team === team && champion.alive,
    ).length;

    const reserve = Array.isArray(this.reserveQueues.get(team))
      ? this.reserveQueues.get(team).length
      : 0;

    return active + inactive + reserve;
  }

  hasLivingChampionsInRoster(team) {
    return this.getLivingRosterCount(team) > 0;
  }

  getPlayerChampions(team) {
    return [
      ...this.activeChampions.values(),
      ...this.deadChampions.values(),
    ].filter((champion) => champion.team === team);
  }

  getChampionAtSlot(team, slot) {
    return (
      [...this.activeChampions.values()].find(
        (c) => c.team === team && c.combatSlot === slot,
      ) || null
    );
  }

  getTeamLine(team) {
    return [...this.activeChampions.values()]
      .filter((c) => c.team === team && Number.isInteger(c.combatSlot))
      .sort((a, b) => a.combatSlot - b.combatSlot);
  }

  getAdjacentChampions(target, { side = "both" } = {}) {
    const champion =
      typeof target === "string" ? this.getChampion(target) : target;

    if (!champion || !Number.isInteger(champion.combatSlot)) return [];

    const left = this.getChampionAtSlot(champion.team, champion.combatSlot - 1);
    const right = this.getChampionAtSlot(
      champion.team,
      champion.combatSlot + 1,
    );

    if (side === "left") return left ? [left] : [];
    if (side === "right") return right ? [right] : [];

    return [left, right].filter(Boolean);
  }

  /**
   * Checks whether the team has room for one more living champion.
   *
   * The field cap applies to champions ONLY: minions occupy none of those
   * slots and have no cap of their own, so a team already fielding three
   * minions can still summon three champions.
   */
  canSpawnOnTeam(
    team,
    maxPerTeam = 3,
    { entityType = "champion", requiredSlots = 1 } = {},
  ) {
    if (entityType === "minion") return true;

    const championsOnField = this.getTeamChampions(team, {
      alive: true,
    }).filter((champion) => champion.entityType !== "minion");

    return championsOnField.length + requiredSlots <= maxPerTeam;
  }

  /**
   * Returns the next free combatSlot (0-based) for a team, or null when every
   * slot in 0..maxPerTeam-1 is taken.
   *
   * Minions never take a champion slot: they search from `maxPerTeam` upwards
   * (extra slots, rendered after the champion line). Occupancy itself still
   * considers every living entity — two entities cannot share a slot, minion
   * or not.
   */
  getNextAvailableSlot(team, maxPerTeam = 3, { entityType = "champion" } = {}) {
    const occupied = new Set(
      [...this.activeChampions.values()]
        .filter(
          (c) => c.team === team && c.alive && Number.isInteger(c.combatSlot),
        )
        .map((c) => c.combatSlot),
    );

    if (entityType === "minion") {
      // No minion cap — the ceiling only bounds the iteration.
      const ceiling = maxPerTeam + MAX_MINION_SLOTS;
      for (let i = maxPerTeam; i < ceiling; i++) {
        if (!occupied.has(i)) return i;
      }
      return null;
    }

    for (let i = 0; i < maxPerTeam; i++) {
      if (!occupied.has(i)) return i;
    }
    return null;
  }

  registerChampion(champion, { trackSnapshot = true } = {}) {
    this.deadChampions.delete(champion.id);

    champion.runtime ??= {};
    champion.runtime.fieldEntryTurn ??= this.match.combat.currentTurn;

    this.activeChampions.set(champion.id, champion);

    if (trackSnapshot) {
      this.combatSnapshot.push({
        championKey: champion.championKey ?? champion.key ?? champion.id,
        id: champion.id,
        team: champion.team,
        combatSlot: champion.combatSlot,
      });
    }
  }

  replaceActiveChampion(champion) {
    if (!champion?.id) return null;

    this.deadChampions.delete(champion.id);
    this.inactiveChampions.delete(champion.id);

    champion.runtime ??= {};
    champion.runtime.fieldEntryTurn ??= this.match.combat.currentTurn;

    this.activeChampions.set(champion.id, champion);

    return champion;
  }

  removeChampion(championId) {
    const champion = this.activeChampions.get(championId);
    if (!champion) return null;

    this.activeChampions.delete(championId);
    this.deadChampions.set(championId, champion);
    return champion;
  }

  /**
   * Creates and registers a champion from its DB key, honoring the field cap and
   * relocating off a taken explicit slot. Fires the onChampionAdded hooks. Returns
   * the instance, or null when the team is full, no slot is free or the key is
   * invalid. Server-only concerns (portrait skin, state broadcast) stay in the
   * server wrapper — this method never touches sockets.
   */
  spawnChampion({
    championKey,
    team,
    combatSlot = null,
    trackSnapshot = true,
    maxPerTeam = 3,
    spawnProtection = true,
  } = {}) {
    const baseData = championDB[championKey];
    if (!baseData) {
      console.warn(`[SPAWN] Aborted: "${championKey}" is not in the championDB.`);
      return null;
    }

    const entityType = baseData.entityType ?? "champion";

    // The field cap counts champions only; minions go straight through.
    if (!this.canSpawnOnTeam(team, maxPerTeam, { entityType })) {
      console.warn(
        `[SPAWN] Aborted: team ${team} already fields ${maxPerTeam} champions (attempted: ${championKey}).`,
      );
      return null;
    }

    if (!Number.isInteger(combatSlot)) {
      combatSlot = this.getNextAvailableSlot(team, maxPerTeam, { entityType });
      if (combatSlot === null) {
        console.warn(
          `[SPAWN] Aborted: no free slot on team ${team} (attempted: ${championKey}).`,
        );
        return null;
      }
    } else if (this.getChampionAtSlot(team, combatSlot)) {
      // The explicit slot (e.g. a revival) is taken — relocate rather than stack.
      const fallbackSlot = this.getNextAvailableSlot(team, maxPerTeam, {
        entityType,
      });
      console.warn(
        `[SPAWN] Slot ${combatSlot} on team ${team} is taken; relocating ${championKey} to ${fallbackSlot}.`,
      );
      if (fallbackSlot === null) return null;
      combatSlot = fallbackSlot;
    }

    const id = generateId(championKey);
    const newChampion = Champion.fromBaseData(baseData, id, team, { combatSlot });
    newChampion.championKey = championKey;

    this.registerChampion(newChampion, { trackSnapshot });

    emitCombatEvent(
      "onChampionAdded",
      {
        // Must NOT be named "owner": emitCombatEvent overwrites that key with the
        // hook's own owner, so emblem hooks could never see the added champion.
        champion: newChampion,
        context: {
          currentTurn: this.currentTurn,
          allChampions: this.activeChampions,
          spawnProtection,
        },
        spawnProtection,
      },
      [newChampion],
      { players: this.match.players },
    );

    if (!trackSnapshot) {
      // Initial setup — manual snapshot.
      this.combatSnapshot.push({
        championKey,
        id,
        team,
        combatSlot: newChampion.combatSlot,
      });
    }

    return newChampion;
  }

  /**
   * Applies a champion mutation request (restore / transform / revertTransform /
   * swap) and returns { champion, log? }, or null when it cannot be applied.
   * On transform, schedules the matching revert. Sockets are the server's job.
   */
  mutateChampion(
    {
      targetId,
      newChampionKey,
      mode = "swap",
      duration = 0,
      hpMode = "preserveRatio",
      statMode = "deltaFromBase",
      expectedToken = null,
      entryDamage = 0,
    } = {},
    options = {},
  ) {
    const mutationContext = options?.context ?? null;

    if (mode === "restore") {
      const restored = this.restoreInactive(targetId);
      return restored ? { champion: restored } : null;
    }

    if (mode === "transform") {
      const transformed = applyChampionTransformation({
        combat: this,
        targetId,
        newChampionKey,
        currentTurn: this.currentTurn,
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
          this.scheduledEffects.push(scheduledEffect);
        }
      }

      return { champion: transformed };
    }

    if (mode === "revertTransform") {
      const reverted = revertChampionTransformation({
        combat: this,
        targetId,
        expectedToken,
      });
      if (!reverted) return null;

      return {
        champion: reverted,
        log: `${formatChampionName(reverted)} returned to its original form.`,
      };
    }

    const old = this.getChampion(targetId);
    if (!old) return null;

    const swappedOut = this.swapOut(targetId);
    if (!swappedOut) return null;

    const baseData = championDB[newChampionKey];
    if (!baseData)
      throw new Error(`ERROR: "${newChampionKey}" not found in championDB.`);

    // Fresh champion with a new ID (never reuse targetId).
    const newId = generateId(newChampionKey);
    const newChampion = Champion.fromBaseData(baseData, newId, old.team, {
      combatSlot: old.combatSlot,
    });
    newChampion.championKey = newChampionKey;

    // Which champion this one replaced — read by the replacement's on-death passive.
    newChampion.runtime.swappedFrom = targetId;

    // A replacement that steps into an incoming blow carries it in, never dead on arrival.
    if (entryDamage > 0) {
      newChampion.HP = Math.max(
        1,
        newChampion.maxHP - Math.round(entryDamage),
      );
    }

    this.registerChampion(newChampion, { trackSnapshot: true });

    return { champion: newChampion };
  }

  /**
   * Remove a dead champion from the game: registers in the history, moves to deadChampions.
   * If the elimination leaves the team without living champions in the lineup, the game ends.
   * Returns an object with the data needed for the server to emit sockets, or null if not found.
   */
  removeChampionFromGame(championId) {
    const champion = this.activeChampions.get(championId);
    if (!champion) return null;

    const scoringTeam = champion.team === 1 ? 2 : 1;
    const scoringSlot = scoringTeam - 1;
    const victimSlot = champion.team - 1;
    const isMinion = champion.entityType === "minion";
    const claimValueAtDeath = Math.min(
      getClaimMaxPoints(champion),
      Math.max(0, Number(champion.runtime?.claimValueBeforeDeath ?? 0) || 0),
    );

    // Every death concedes the claim value of the dead champion at the moment of death (even if 0) plus a fixed 2pts bonus for the kill itself.
    const deathBonus = 2;
    // If the team receiving the points is 10pts or more behind on the scoreboard, they get
    // an additional 2pts bonus (totaling 4pts bonus for the kill).
    // Minions never grant the comeback bonus.
    const scoreDeficit =
      (this.playerScores[victimSlot] || 0) -
      (this.playerScores[scoringSlot] || 0);
    const comebackBonus = !isMinion && scoreDeficit >= 10 ? 2 : 0;
    const killPoints = claimValueAtDeath + deathBonus + comebackBonus;

    let scoreAwarded = false;

    if (killPoints > 0) {
      this.addPointForSlot(scoringSlot, killPoints);
      scoreAwarded = true;
    }

    this.logTurnEvent("championDied", {
      championId,
      championName: champion.name,
      team: champion.team,
      scoringTeam,
      claimValueAtDeath,
      deathBonus,
      comebackBonus,
      killPoints,
    });
    this.ensureTurnEntry().championsDeadThisTurn.push(championId);

    this.removeChampion(championId);

    if (!this.hasLivingChampionsInRoster(champion.team)) {
      this.gameEnded = true;
    }

    return {
      championId,
      championName: champion.name,
      team: champion.team,
      scoringTeam,
      scoringSlot,
      claimValueAtDeath,
      deathBonus,
      comebackBonus,
      killPoints,
      scoreAwarded,
      scorePayload: scoreAwarded ? this.getScorePayload() : null,
      gameEnded: this.gameEnded,
    };
  }

  clearActions() {
    this.pendingActions.length = 0;
  }

  enqueueAction(action) {
    if (!action) return;
    this.pendingActions.push(action);
  }

  nextTurn() {
    this.currentTurn += 1;
  }

  resolveWinnerSlot() {
    const player1Score = this.playerScores[0] || 0;
    const player2Score = this.playerScores[1] || 0;

    if (player1Score !== player2Score) {
      return player1Score > player2Score ? 0 : 1;
    }

    const team1Living = this.getLivingRosterCount(1);
    const team2Living = this.getLivingRosterCount(2);

    if (team1Living !== team2Living) {
      return team1Living > team2Living ? 0 : 1;
    }

    const fieldCount1 = this.getTeamChampions(1, { alive: true }).length;
    const fieldCount2 = this.getTeamChampions(2, { alive: true }).length;

    if (fieldCount1 !== fieldCount2) {
      return fieldCount1 > fieldCount2 ? 0 : 1;
    }

    return null;
  }

  checkGameEnd({
    maxTurns = 20,
    checkTurnLimit = false,
    scoreThreshold = 60,
  } = {}) {
    if (!this.gameEnded && checkTurnLimit && this.currentTurn >= maxTurns) {
      this.gameEnded = true;
    }

    if (
      !this.gameEnded &&
      checkTurnLimit &&
      Number.isFinite(scoreThreshold) &&
      (this.playerScores[0] >= scoreThreshold ||
        this.playerScores[1] >= scoreThreshold)
    ) {
      this.gameEnded = true;
    }

    if (!this.gameEnded) {
      return {
        ended: false,
        winnerSlot: null,
      };
    }

    return {
      ended: true,
      winnerSlot: this.resolveWinnerSlot(),
    };
  }

  clearTurnReadiness() {
    this.playersReadyToEndTurn.clear();
  }

  hasSummonedThisTurn(team) {
    return this.summonedThisTurn.has(team);
  }

  markSummonedThisTurn(team) {
    this.summonedThisTurn.add(team);
  }

  clearTurnSummons() {
    this.summonedThisTurn.clear();
  }

  addPointForSlot(slot, amount = 1) {
    if (!Array.isArray(this.playerScores)) this.playerScores = [0, 0];
    const normalizedSlot = Number(slot);
    const normalizedAmount = Number(amount) || 0;
    if (!Number.isInteger(normalizedSlot) || normalizedSlot < 0) return;
    this.playerScores[normalizedSlot] =
      (this.playerScores[normalizedSlot] || 0) + normalizedAmount;
  }

  addPointsForSlot(slot, amount = 1) {
    this.addPointForSlot(slot, amount);
  }

  setWinnerScore(slot, score = 0) {
    if (!Array.isArray(this.playerScores)) this.playerScores = [0, 0];
    this.playerScores[slot] = score;
    this.gameEnded = true;
  }

  getScorePayload() {
    return {
      player1: this.playerScores[0] || 0,
      player2: this.playerScores[1] || 0,
    };
  }
}

export class GameMatch {
  constructor() {
    this.players = [null, null];
    this.lobby = new LobbyState(this);
    this.combat = new CombatState(this);
  }

  getPlayer(slot) {
    return this.players[slot] || null;
  }

  setPlayer(slot, player) {
    this.players[slot] = player || null;
  }

  getOpponent(slot) {
    return slot === 0 ? this.players[1] : this.players[0];
  }

  getConnectedPlayers() {
    return this.players.filter((player) => player?.socketId);
  }

  getPlayerTeam(socketId) {
    const player = this.players.find((entry) => entry?.socketId === socketId);
    return player ? player.team : null;
  }

  getPlayerBySocketId(socketId) {
    return this.players.find((entry) => entry?.socketId === socketId) || null;
  }

  assignPlayerToTeam(socketId, team) {
    const slot = team - 1;
    const player =
      this.getPlayer(slot) ||
      this.players.find((entry) => entry?.socketId === socketId) ||
      null;

    if (!player) return null;

    player.team = team;
    player.setSocket(socketId);
    this.assignSocketToSlot(socketId, slot);
    return player;
  }

  areBothPlayersConnected() {
    return !!(this.players[0] && this.players[1]);
  }

  getConnectedCount() {
    return this.players.filter((player) => player !== null).length;
  }

  getPlayerNamesEntries() {
    const entries = [];

    for (let slot = 0; slot < this.players.length; slot++) {
      const player = this.players[slot];
      if (!player) continue;
      entries.push([slot, player.username]);
    }

    return entries;
  }

  isTeamSelected(slot) {
    return !!this.players[slot]?.isTeamSelected();
  }

  // Lobby delegation
  assignSocketToSlot(socketId, slot) {
    this.lobby.assignSocketToSlot(socketId, slot);
  }

  getSlotBySocket(socketId) {
    return this.lobby.getSlotBySocket(socketId);
  }

  removeSocket(socketId) {
    this.lobby.removeSocket(socketId);
  }

  setSelectionTimer(slot, timerId) {
    this.lobby.setSelectionTimer(slot, timerId);
  }

  clearSelectionTimer(slot) {
    this.lobby.clearSelectionTimer(slot);
  }

  setDisconnectionTimer(slot, timerId) {
    this.lobby.setDisconnectionTimer(slot, timerId);
  }

  getDisconnectionTimer(slot) {
    return this.lobby.getDisconnectionTimer(slot);
  }

  clearDisconnectionTimer(slot) {
    this.lobby.clearDisconnectionTimer(slot);
  }

  setFirstChoiceTimer(socketId, timerId) {
    this.lobby.setFirstChoiceTimer(socketId, timerId);
  }

  clearFirstChoiceTimer(socketId) {
    this.lobby.clearFirstChoiceTimer(socketId);
  }

  clearAllFirstChoiceTimers() {
    this.lobby.clearAllFirstChoiceTimers();
  }

  // Combat delegation
  ensureTurnEntry() {
    return this.combat.ensureTurnEntry();
  }

  logTurnEvent(eventType, eventData) {
    this.combat.logTurnEvent(eventType, eventData);
  }

  registerChampion(champion, options = {}) {
    this.combat.registerChampion(champion, options);
  }

  removeChampion(championId) {
    return this.combat.removeChampion(championId);
  }

  removeChampionFromGame(championId) {
    return this.combat.removeChampionFromGame(championId);
  }

  getChampion(championId) {
    return this.combat.getChampion(championId);
  }

  getCurrentTurn() {
    return this.combat.currentTurn;
  }

  nextTurn() {
    this.combat.nextTurn();
  }

  resetCombat() {
    this.combat.reset();
  }

  startCombat() {
    this.combat.start();
  }

  isCombatStarted() {
    return this.combat.started;
  }

  isGameEnded() {
    return this.combat.gameEnded;
  }

  addPointForSlot(slot, amount = 1) {
    this.combat.addPointForSlot(slot, amount);
  }

  addPointsForSlot(slot, amount = 1) {
    this.addPointForSlot(slot, amount);
  }

  setWinnerScore(slot, score = 0) {
    this.combat.setWinnerScore(slot, score);
  }

  getScorePayload() {
    return this.combat.getScorePayload();
  }

  resolveWinnerSlot() {
    return this.combat.resolveWinnerSlot();
  }

  checkGameEnd({
    maxTurns = 20,
    checkTurnLimit = false,
    scoreThreshold = 60,
  } = {}) {
    return this.combat.checkGameEnd({
      maxTurns,
      checkTurnLimit,
      scoreThreshold,
    });
  }

  clearActions() {
    this.combat.clearActions();
  }

  enqueueAction(action) {
    this.combat.enqueueAction(action);
  }

  clearTurnReadiness() {
    this.combat.clearTurnReadiness();
  }

  hasSummonedThisTurn(team) {
    return this.combat.hasSummonedThisTurn(team);
  }

  markSummonedThisTurn(team) {
    this.combat.markSummonedThisTurn(team);
  }

  clearTurnSummons() {
    this.combat.clearTurnSummons();
  }

  addReadyPlayer(slot) {
    this.combat.playersReadyToEndTurn.add(slot);
  }

  removeReadyPlayer(slot) {
    this.combat.playersReadyToEndTurn.delete(slot);
  }

  isPlayerReady(slot) {
    return this.combat.playersReadyToEndTurn.has(slot);
  }

  getReadyPlayersCount() {
    return this.combat.playersReadyToEndTurn.size;
  }

  addFinishedAnimationSocket(socketId) {
    this.combat.finishedAnimationSockets.add(socketId);
  }

  clearFinishedAnimationSockets() {
    this.combat.finishedAnimationSockets.clear();
  }

  getFinishedAnimationCount() {
    return this.combat.finishedAnimationSockets.size;
  }

  // ===================================
  // First Champion Choice Phase Logic
  // ===================================

  /**
   * Registra a escolha do primeiro campeão de um jogador e limpa seu timeout.
   * Retorna `false` se o jogador já escolheu, `true` se a escolha foi registrada.
   */
  setFirstChampionChoice(socketId, championKey) {
    if (this.combat.firstChampionChoices.has(socketId)) {
      return false; // Já escolheu, ignora.
    }

    this.clearFirstChoiceTimer(socketId);
    this.combat.firstChampionChoices.set(socketId, championKey);
    return true;
  }

  /**
   * Finaliza a fase de escolha: spawna os campeões, atualiza as reservas.
   * Recebe a função `spawnChampion` como dependência para não lidar com sockets.
   * Retorna as escolhas feitas para o orquestrador emitir.
   */
  finalizeFirstChampionChoices(spawnChampionFn) {
    this.clearAllFirstChoiceTimers();

    const choices = [];
    this.combat.firstChampionChoices.forEach((championKey, socketId) => {
      const team = this.getPlayerTeam(socketId);
      choices.push({ championKey, team });

      // Picking one half of a duo brings its whole line-up in.
      const entering = getDuoForCore(championKey)?.cores ?? [championKey];

      entering.forEach((key, offset) => {
        spawnChampionFn({
          championKey: key,
          team,
          combatSlot: offset,
          trackSnapshot: true,
          spawnProtection: false,
        });
      });

      const reserve = this.combat.reserveQueues.get(team) || [];
      this.combat.reserveQueues.set(
        team,
        reserve.filter((key) => !entering.includes(key)),
      );
    });

    return { choices };
  }

  reset() {
    this.lobby.reset();
    this.combat.reset();
  }

  clearPlayers() {
    this.players = [null, null];
    this.lobby.reset();
    this.combat.reset();
  }
}
