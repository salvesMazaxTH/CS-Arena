import { getClaimMaxPoints, getClaimPoints } from "../combat/claim.js";
import {
  ARENA_ROW_SIZE,
  STAR_CHECKPOINT_TURNS,
  STAR_SCORE_THRESHOLD,
  STARS_TO_WIN,
  applyGenericScoreHalving,
} from "./matchRules.js";
import { championDB } from "../../data/championDB.js";
import { getDuoForCore } from "../../data/duos.js";
import { SpawnProtection } from "../combat/spawnProtection.js";
import { Nothingness } from "../combat/nothingness.js";
import { Champion } from "../../core/Champion.js";
import { releaseSustainedBy, roundToFive } from "../../core/championCombat.js";
import { generateId } from "../../utils/id.js";
import { emitCombatEvent } from "../combat/combatEvents.js";
import { formatChampionName } from "../../ui/formatters.js";
import {
  applyChampionTransformation,
  revertChampionTransformation,
} from "./championTransformation.js";

// Every living entity a team fields counts against this, minions included.
const MAX_ENTITIES_PER_TEAM = 8;

// Percentage stats are left alone: they are already small and rounding to five
// would distort them.
const SCALABLE_STATS = ["HP", "Attack", "Defense", "Speed"];

class LobbyState {
  constructor(match) {
    this.match = match;
    this.socketToSlot = new Map();
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
    this.phase = "planning";
    this.pendingActions = [];
    this.activeChampions = new Map();
    this.deadChampions = new Map();
    this.inactiveChampions = new Map(); // Champions already materialized and swapped out but can return (e.g., Lana when Tutu enters field)
    this.reserveQueues = new Map(); // Fila de reserva por time (unmaterialized roster/lineup)
    this.playerScores = [0, 0]; // score system enabled
    this.resetStars();
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
    this.phase = "planning";
    this.playersReadyToEndTurn.clear();
    this.finishedAnimationSockets.clear();
    this.turnHistory.clear();
    this.scheduledEffects = [];
    this.playerScores = [0, 0]; // reset progress also clears score counters
    this.resetStars();
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
    this._releaseSustainedBy(championId);
    return champion;
  }

  /** Whatever a champion sustained on others ends the moment it leaves the field. */
  _releaseSustainedBy(sourceId) {
    for (const map of [
      this.activeChampions,
      this.inactiveChampions,
      this.deadChampions,
    ]) {
      for (const champion of map.values()) releaseSustainedBy(champion, sourceId);
    }
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

    const slot = champion.combatSlot;
    const column = slot % ARENA_ROW_SIZE;
    const left =
      column > 0 ? this.getChampionAtSlot(champion.team, slot - 1) : null;
    const right =
      column < ARENA_ROW_SIZE - 1
        ? this.getChampionAtSlot(champion.team, slot + 1)
        : null;

    if (side === "left") return left ? [left] : [];
    if (side === "right") return right ? [right] : [];

    return [left, right].filter(Boolean);
  }

  /**
   * Checks whether the team has room for `requiredSlots` more living entities.
   * Every entity type counts toward the team-wide entity cap; only entities of
   * type "champion" are further bound by `maxPerTeam`.
   */
  canSpawnOnTeam(
    team,
    maxPerTeam = 3,
    { entityType = "champion", requiredSlots = 1 } = {},
  ) {
    const entitiesOnField = this.getTeamChampions(team, { alive: true });

    if (entitiesOnField.length + requiredSlots > MAX_ENTITIES_PER_TEAM) {
      return false;
    }

    if (entityType !== "champion") return true;

    const championsOnField = entitiesOnField.filter(
      (champion) => (champion.entityType ?? "champion") === "champion",
    );

    return championsOnField.length + requiredSlots <= maxPerTeam;
  }

  /**
   * Returns the first free combatSlot (0-based) for a team, or null when every
   * slot is taken. No slot is reserved for any entity type.
   */
  getNextAvailableSlot(team) {
    const occupied = new Set(
      [...this.activeChampions.values()]
        .filter(
          (c) => c.team === team && c.alive && Number.isInteger(c.combatSlot),
        )
        .map((c) => c.combatSlot),
    );

    for (let i = 0; i < MAX_ENTITIES_PER_TEAM; i++) {
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
    this._releaseSustainedBy(championId);
    return champion;
  }

  /**
   * Creates and registers a champion from its DB key, honoring the team-wide
   * entity cap and relocating off a taken explicit slot. The champion cap is the
   * line-up summon's to enforce, so other effects may bring in a fourth.
   * Fires the onChampionAdded hooks. Returns the instance, or null when the team
   * is full, no slot is free or the key is invalid. Server-only concerns (portrait skin, state broadcast) stay in the
   * server wrapper — this method never touches sockets.
   */
  spawnChampion({
    championKey,
    team,
    combatSlot = null,
    trackSnapshot = true,
    spawnProtection = true,
    asEntityType = null,
    statScale = 1,
    statScaleByStat = null,
    runtime = null,
  } = {}) {
    const dbData = championDB[championKey];
    if (!dbData) {
      console.warn(`[SPAWN] Aborted: "${championKey}" is not in the championDB.`);
      return null;
    }

    const entityType = asEntityType ?? dbData.entityType ?? "champion";

    const scaledStats = {};
    for (const stat of SCALABLE_STATS) {
      const scale = statScaleByStat?.[stat] ?? statScale;
      if (scale !== 1) scaledStats[stat] = roundToFive(dbData[stat] * scale);
    }
    const baseData = { ...dbData, entityType, ...scaledStats };

    if (!this.canSpawnOnTeam(team, Infinity, { entityType })) {
      console.warn(
        `[SPAWN] Aborted: team ${team} has no room for another ${entityType} (attempted: ${championKey}).`,
      );
      return null;
    }

    if (!Number.isInteger(combatSlot)) {
      combatSlot = this.getNextAvailableSlot(team);
      if (combatSlot === null) {
        console.warn(
          `[SPAWN] Aborted: no free slot on team ${team} (attempted: ${championKey}).`,
        );
        return null;
      }
    } else if (this.getChampionAtSlot(team, combatSlot)) {
      // The explicit slot (e.g. a revival) is taken — relocate rather than stack.
      const fallbackSlot = this.getNextAvailableSlot(team);
      console.warn(
        `[SPAWN] Slot ${combatSlot} on team ${team} is taken; relocating ${championKey} to ${fallbackSlot}.`,
      );
      if (fallbackSlot === null) return null;
      combatSlot = fallbackSlot;
    }

    const id = generateId(championKey);
    const newChampion = Champion.fromBaseData(baseData, id, team, { combatSlot });
    newChampion.championKey = championKey;

    // Seeded before onChampionAdded so the newcomer's own hooks can read it.
    if (runtime) Object.assign(newChampion.runtime, runtime);

    if (spawnProtection !== false && entityType === "champion") {
      SpawnProtection.grant(newChampion);
    }

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
      // Everyone on the field hears the arrival; hookScope "champion" narrows it to the newcomer.
      this.activeChampions,
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
   * Applies a champion mutation request (summon / restore / transform /
   * revertTransform / vanish / recallFromNothingness / swap) and returns { champion, log? }, or
   * null when it cannot be applied.
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
      turns = 1,
      returnState = null,
      ruptureSourceId = null,
      championKey = null,
      team = null,
      asEntityType = null,
      runtime = null,
      onSettled = null,
    } = {},
    options = {},
  ) {
    const mutationContext = options?.context ?? null;

    if (mode === "summon") {
      const summoned = this.spawnChampion({
        championKey,
        team,
        asEntityType,
        runtime,
      });
      // Told either way, so the requester can speak for a full field too.
      onSettled?.(summoned, mutationContext);
      return summoned ? { champion: summoned } : null;
    }

    if (mode === "vanish") {
      return Nothingness.send(this, targetId, {
        turns,
        returnState,
        ruptureSourceId,
        context: mutationContext,
      });
    }

    if (mode === "recallFromNothingness") {
      return Nothingness.recall(this, targetId, { context: mutationContext });
    }

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
    // The pre-damage stamp only describes the turn it was taken on; a death
    // that never went through a DamageEvent has to be valued live.
    const stampedValue =
      champion.runtime?.claimValueBeforeDeathTurn === this.currentTurn
        ? Number(champion.runtime.claimValueBeforeDeath) || 0
        : getClaimPoints(champion, this.currentTurn);
    const claimValueAtDeath = Math.min(
      getClaimMaxPoints(champion),
      Math.max(0, stampedValue),
    );

    // Every death concedes the CLAIM value of the dead champion at the moment of death (even if 0) plus a fixed 2pts bonus for the kill itself.
    const deathBonus = 2;
    // If the team receiving the points is 10pts or more behind on the scoreboard, they get
    // an additional 2pts bonus (totaling 4pts bonus for the kill).
    // Minions never grant the comeback bonus.
    const scoreDeficit =
      (this.playerScores[victimSlot] || 0) -
      (this.playerScores[scoringSlot] || 0);
    const comebackBonus = !isMinion && scoreDeficit >= 10 ? 2 : 0;
    const rawKillPoints = champion.runtime?.leavesNoDeath
      ? 0
      : claimValueAtDeath + deathBonus + comebackBonus;

    let scoreAwarded = false;
    let killPoints = 0;

    if (rawKillPoints > 0) {
      killPoints = this.addPointForSlot(scoringSlot, rawKillPoints, true);
      scoreAwarded = true;
    }

    champion.runtime.deathConcededPoints = killPoints;

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

  resetStars() {
    this.playerStars = [0, 0];
    // The turn each slot first reached STAR_SCORE_THRESHOLD, stamped the
    // moment the points land — not at the end of the turn.
    this.scoreThresholdTurns = [null, null];
    this.thresholdStarAwarded = false;
  }

  /** The slot that reached STAR_SCORE_THRESHOLD strictly first; a same-turn crossing is a tie. */
  getFirstToScoreThresholdSlot() {
    const [turn1, turn2] = this.scoreThresholdTurns;
    if (turn1 == null && turn2 == null) return null;
    if (turn2 == null) return 0;
    if (turn1 == null) return 1;
    if (turn1 === turn2) return null;
    return turn1 < turn2 ? 0 : 1;
  }

  /**
   * End-of-turn star awards: the once-per-match threshold star for whoever
   * first reached STAR_SCORE_THRESHOLD (both slots when they reached it in the
   * same turn), then the checkpoint star for the points leader
   * (both slots on a tie). Returns which slots earned which star.
   * everyTurnIsCheckpoint treats every turn as a checkpoint (test setting).
   */
  awardTurnEndStars({ everyTurnIsCheckpoint = false } = {}) {
    const thresholdSlots = [];
    const checkpointSlots = [];

    if (!this.thresholdStarAwarded) {
      const reachedTurns = this.scoreThresholdTurns.filter((turn) => turn != null);
      const firstTurn = reachedTurns.length ? Math.min(...reachedTurns) : null;
      for (const slot of [0, 1]) {
        if (firstTurn == null || this.scoreThresholdTurns[slot] !== firstTurn) continue;
        this.playerStars[slot] += 1;
        thresholdSlots.push(slot);
      }
      if (thresholdSlots.length) this.thresholdStarAwarded = true;
    }

    if (
      everyTurnIsCheckpoint ||
      STAR_CHECKPOINT_TURNS.includes(this.currentTurn)
    ) {
      const score1 = this.playerScores[0] || 0;
      const score2 = this.playerScores[1] || 0;
      if (score1 >= score2) checkpointSlots.push(0);
      if (score2 >= score1) checkpointSlots.push(1);
      for (const slot of checkpointSlots) this.playerStars[slot] += 1;
    }

    return { thresholdSlots, checkpointSlots };
  }

  resolveWinnerSlot() {
    const player1Stars = this.playerStars[0] || 0;
    const player2Stars = this.playerStars[1] || 0;

    if (player1Stars !== player2Stars) {
      return player1Stars > player2Stars ? 0 : 1;
    }

    const firstToThreshold = this.getFirstToScoreThresholdSlot();
    if (firstToThreshold != null) return firstToThreshold;

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

  checkGameEnd({ endOfTurn = false } = {}) {
    if (
      !this.gameEnded &&
      endOfTurn &&
      this.playerStars.some((stars) => stars >= STARS_TO_WIN)
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

  addPointForSlot(slot, amount = 1, generic = false) {
    if (!Array.isArray(this.playerScores)) this.playerScores = [0, 0];
    const normalizedSlot = Number(slot);
    if (!Number.isInteger(normalizedSlot) || normalizedSlot < 0) return 0;
    const currentScore = this.playerScores[normalizedSlot] || 0;
    const rawAmount = Number(amount) || 0;
    const awarded = generic
      ? applyGenericScoreHalving(currentScore, rawAmount)
      : rawAmount;
    this.playerScores[normalizedSlot] = Math.max(0, currentScore + awarded);
    if (
      this.scoreThresholdTurns[normalizedSlot] == null &&
      this.playerScores[normalizedSlot] >= STAR_SCORE_THRESHOLD
    ) {
      this.scoreThresholdTurns[normalizedSlot] = this.currentTurn;
    }
    return awarded;
  }

  addPointsForSlot(slot, amount = 1) {
    return this.addPointForSlot(slot, amount);
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
      stars: {
        player1: this.playerStars[0] || 0,
        player2: this.playerStars[1] || 0,
      },
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

  addPointForSlot(slot, amount = 1, generic = false) {
    return this.combat.addPointForSlot(slot, amount, generic);
  }

  addPointsForSlot(slot, amount = 1) {
    return this.addPointForSlot(slot, amount);
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

  checkGameEnd({ endOfTurn = false } = {}) {
    return this.combat.checkGameEnd({ endOfTurn });
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
