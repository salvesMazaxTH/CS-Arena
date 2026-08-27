import { formatChampionName } from "../../ui/formatters.js";
import { getHardCCActionDenial } from "../../core/championStatus.js";
import { emitCombatEvent } from "./combatEvents.js";
import { SpawnProtection } from "./spawnProtection.js";
import {
  CLAIM_ACTION_KEY,
  CLAIM_MIN_MOMENTUM,
  getClaimPoints,
} from "./claim.js";
import { snapshotChampions } from "./snapshotChampions.js";

const RESOURCE_DEBUG_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isResourceDebugEnabled() {
  if (typeof process === "undefined") return false;

  const raw = process?.env?.DEBUG_RESOURCE_FLOW;

  if (raw == null) {
    return process?.env?.NODE_ENV !== "production";
  }

  return RESOURCE_DEBUG_TRUE_VALUES.has(String(raw).toLowerCase());
}

function logResourceDebug(payload) {
  if (!isResourceDebugEnabled()) return;
  console.log("[RESOURCE_DEBUG]", payload);
}

// Faixas de 25 de dano = +1 Momentum a partir de 55; abaixo disso é a faixa inicial (exceção).
function getMomentumFromDamageDealt(totalDamage) {
  const d = Math.max(0, Math.floor(Number(totalDamage) || 0));
  if (d <= 19) return 1;
  if (d <= 54) return 2;
  if (d >= 350) return 15;
  return 3 + Math.floor((d - 55) / 25);
}

// Faixas de 30 (até 204) e depois 25 de dano = +1 Momentum; 255-279 é um salto proposital
// (recompensa menor nas faixas baixas de dano sofrido, que vai se equilibrando nas altas).
function getMomentumFromDamageTaken(totalDamage) {
  const d = Math.max(0, Math.floor(Number(totalDamage) || 0));
  if (d <= 54) return 1;
  if (d <= 204) return 2 + Math.floor((d - 55) / 30);
  if (d <= 254) return 7 + Math.floor((d - 205) / 25);
  if (d <= 279) return 11;
  if (d >= 350) return 15;
  return 12 + Math.floor((d - 280) / 25);
}

export class TurnResolver {
  constructor(match, editMode, options = {}) {
    this.match = match;
    this.combat = match.combat;
    this.editMode = editMode ?? {};
    this.mutationHandler =
      typeof options?.mutationHandler === "function"
        ? options.mutationHandler
        : null;
  }

  // ============================================================
  //  RESOLUÇÃO DO TURNO (entry point)
  // ============================================================

  resolveTurn() {
    const actionResults = [];
    // Lógica de trocas/switches desativada: mantido apenas para compatibilidade
    // de shape com o servidor.
    const switchResults = [];
    let actionOrder = 0;

    const turnExecutionMap = new Map(); // championId -> executionIndex

    while (this.combat.pendingActions.length > 0) {
      const actions = this.combat.pendingActions;

      actions.sort((a, b) => {
        const pA = a.getPriority(this.match);
        const pB = b.getPriority(this.match);
        if (pA !== pB) return pB - pA;

        const sA = a.getSpeed(this.match);
        const sB = b.getSpeed(this.match);
        if (sA !== sB) return sB - sA;

        return Math.random() - 0.5; // desempate aleatório para ações com mesma prioridade e velocidade
      });

      const action = actions.shift(); // remove a próxima ação

      // Lógica de trocas/switches desativada.
      // if (action.type === "switch") {
      //   const switchResult = this.executeSwitch(action);
      //   if (switchResult) switchResults.push(switchResult);
      //   continue;
      // }

      // 🔹 registra a posição da execução
      action.executionIndex = actionOrder++;

      const user = this.combat.activeChampions.get(action.userId);

      if (!user) {
        this.refundActionResource(user, action);
        actionResults.push({
          executed: false,
          reason: "inactive",
          user,
          action,
          logMessage: `Ação de campeão desconhecido ignorada (não ativo).`,
        });
        continue;
      }

      turnExecutionMap.set(user.id, action.executionIndex);

      const context = this.createBaseContext({ sourceId: user.id });
      context.executionIndex = action.executionIndex;
      context.turnExecutionMap = turnExecutionMap;

      const result = this.executeSkillAction(action, turnExecutionMap, context);

      const scoreResults = (result?.results || []).filter(
        (entry) => entry?.type === "score",
      );

      if (scoreResults.length > 0) {
        for (const scoreResult of scoreResults) {
          this.match.addPointForSlot(
            scoreResult.scoringSlot,
            scoreResult.amount,
          );
        }

        result.scorePayload = this.match.getScorePayload();
      }

      actionResults.push(result);

      const repeat = result?.repeatActionRequest;
      actionOrder = this.handleRepeatAction(
        repeat,
        action,
        actionOrder,
        actionResults,
        turnExecutionMap,
      );
    }

    const deathContext = this.createBaseContext({ sourceId: null });
    const deathResults = this.processChampionDeaths(deathContext);

    return { actionResults, deathResults, switchResults };
  }

  // ============================================================
  //  EXECUÇÃO DE SWITCH (DESATIVADA)
  // ============================================================

  // executeSwitch(action) {
  //   const outId = action.championToSwitchOutId ?? action.userId;
  //   if (outId) {
  //     const champion = this.combat.activeChampions.get(outId);
  //     if (champion) {
  //       action.switchedOutChampion = champion; // passado ao servidor para bookkeeping (bench, slot, efeitos)
  //       this.combat.activeChampions.delete(outId);
  //     }
  //   }
  //   return action;
  // }

  // ============================================================
  //  MANIPULAÇÃO DE REPEAT ACTION (Passivas)
  // ============================================================

  handleRepeatAction(
    repeat,
    baseAction,
    actionOrder,
    actionResults,
    turnExecutionMap,
  ) {
    if (!repeat?.userId || !repeat?.skillKey) return actionOrder;

    const repeatAction = {
      userId: repeat.userId,
      skillKey: repeat.skillKey,
      targetIds: repeat.targetIds ?? {},
      priority: Number.isFinite(repeat.priority)
        ? repeat.priority
        : (baseAction.priority ?? 0),
      speed: Number.isFinite(repeat.speed)
        ? repeat.speed
        : (baseAction.speed ?? 0),
      turn: baseAction.turn,
      momentumCost: 0,
      type: "followUp",
    };

    repeatAction.executionIndex = actionOrder++;

    const repeatContext = this.createBaseContext({
      sourceId: repeat.userId,
    });

    repeatContext.executionIndex = repeatAction.executionIndex;
    repeatContext.turnExecutionMap = turnExecutionMap;
    repeatContext.isPassiveRepeat = true;

    const repeatResult = this.executeSkillAction(
      repeatAction,
      turnExecutionMap,
      repeatContext,
    );

    actionResults.push(repeatResult);
    return actionOrder;
  }

  // ============================================================
  //  DEATH PROCESSING
  // ============================================================

  processChampionDeaths(context = null) {
    const results = [];
    for (const champ of this.combat.activeChampions.values()) {
      if (!champ.alive) {
        const result = this.match.removeChampionFromGame(champ.id);
        if (result) results.push(result);

        if (context) {
          // The dead champion is already out of activeChampions, so it is
          // appended explicitly: passives that react to their OWN death (such
          // as Jeff's revival) must still be reached, and it is the only hook
          // that fires for deaths that never went through a DamageEvent.
          emitCombatEvent(
            "onChampionDeath",
            { deadChampion: champ, context },
            [...this.combat.activeChampions.values(), champ],
          );
        }
      }
    }
    return results;
  }

  // ============================================================
  //  EXECUÇÃO DE AÇÃO INDIVIDUAL
  // ============================================================

  executeSkillAction(action, turnExecutionMap, context) {
    // console.log("[EXECUTE SKILL ACTION] [TARGETS]", action);

    const user = this.combat.activeChampions.get(action.userId);

    // 1. valida existência / alive
    const isInactive = !user || !user.alive;
    if (isInactive) {
      const userName = user ? formatChampionName(user) : "campeão desconhecido";
      return {
        executed: false,
        reason: "inactive",
        user,
        action,
        logMessage: `Ação de ${userName} ignorada (não ativo).`,
      };
    }

    // 2. valida ação (hooks)
    const denial = this.canExecuteAction(user, action);
    if (denial?.denied) {
      context.registerDialog({
        message: denial.message || `${formatChampionName(user)} não pode agir.`,
        sourceId: user.id,
        damageDepth: context.damageDepth ?? 0,
      });

      return {
        executed: false,
        reason: "denied",
        denial,
        user,
        action,
      };
    }

    if (action?.skillKey === CLAIM_ACTION_KEY) {
      return this.executeClaimAction(user, action, turnExecutionMap, context);
    }

    // 3. valida skill
    const skill = user.skills.find((s) => s.key === action.skillKey);
    if (!skill) {
      return {
        executed: false,
        reason: "skill_not_found",
        user,
        action,
        logMessage: `Erro: Habilidade ${action.skillKey} não encontrada para ${formatChampionName(user)}.`,
      };
    }

    // 4. resolve targets
    const roleTargets = this.resolveSkillTargets(user, skill, action, context);

    // (game design) Se quiser que habilidades sem alvo NÃO consumam recurso,
    // mover o consumo de recurso para depois da verificação de !roleTargets.
    // Caso contrário, manter aqui para consumir mesmo sem alvo.

    // 5. Captura o valor de Claim ANTES do gasto de Momentum.
    // Algumas habilidades podem utilizar esse valor como referência.
    context.preActionClaimPoints = getClaimPoints(user, context.currentTurn);

    // 6. AGORA SIM: consumir recurso
    if (action.momentumCost > 0 && !this.editMode.freeCostSkills) {
      this.applyResourceChange({
        target: user,
        amount: -action.momentumCost,
        context,
        sourceId: user.id,
      });
    }

    // console.log("STEP 1 - TARGETS:", roleTargets);
    if (!roleTargets) {
      context.registerDialog({
        message: `${formatChampionName(user)} usou <b>${skill.name}</b>, mas não encontrou alvo.`,

        sourceId: user.id,
        damageDepth: context.damageDepth ?? 0,
      });

      this.registerSkillUsageInTurn(user, skill, {});

      context._intermediateSnapshot = snapshotChampions(
        this.combat.activeChampions,
      );

      return {
        executed: true,
        user,
        skill,
        context,
        action,
        results: [
          {
            log: `${formatChampionName(user)} usou <b>${skill.name}</b>, mas não encontrou alvo.`,
            noTargets: true,
          },
        ],
      };
    }

    const targetsArray = Object.values(roleTargets);
    // console.log("STEP 2 - TARGETS ARRAY:", targetsArray);

    console.log(
      `[executeSkillAction] executionIndex set to ${context.executionIndex} for skill ${skill.name}`,
    );

    const skillResults = this.performSkillExecution(
      user,
      skill,
      targetsArray,
      context,
      action,
    );

    this.processImmediateChampionMutations(context);

    // Captura snapshot intermediário AGORA, antes da próxima ação mutar os champions

    context._intermediateSnapshot = snapshotChampions(
      this.combat.activeChampions,
    );

    return {
      executed: true,
      user,
      skill,
      context,
      action,
      results: skillResults,
      repeatActionRequest: context.repeatActionRequest || null,
    };
  }

  executeClaimAction(user, action, turnExecutionMap, context) {
    if (
      !this.editMode.freeCostSkills &&
      (Number(user.momentum) || 0) < CLAIM_MIN_MOMENTUM
    ) {
      return {
        executed: false,
        reason: "denied",
        denial: {
          denied: true,
          message: `${formatChampionName(user)} não tem Momentum suficiente para CLAIM.`,
        },
        user,
        action,
      };
    }

    const claimSkill = {
      key: CLAIM_ACTION_KEY,
      name: "CLAIM",
      priority: 0,
      targetSpec: [],
    };

    context.currentSkill = claimSkill;
    context.actionSource = user;

    this.combat.activeChampions.forEach((champion) => {
      champion.runtime = champion.runtime || {};
      champion.runtime.currentContext = context;
    });

    try {
      const claimPoints = getClaimPoints(user, this.combat.currentTurn);

      // Publishes the authoritative number of points this CLAIM scored, so
      // hooks reacting to it (Aren's Abyssal Depths, Avarion's Miser's Toll)
      // read the value that was actually awarded instead of recomputing it.
      context.preActionClaimPoints = claimPoints;

      this.registerSkillUsageInTurn(user, claimSkill, {});

      const scoringSlot = user.team - 1;

      this.match.addPointForSlot(scoringSlot, claimPoints);

      const actionResolvedResults = emitCombatEvent(
        "onActionResolved",
        {
          actionSource: user,
          targets: [],
          skill: claimSkill,
          action,
          context,
        },
        this.combat.activeChampions,
      );

      const normalizedActionResolvedResults = Array.isArray(
        actionResolvedResults,
      )
        ? actionResolvedResults
        : actionResolvedResults
          ? [actionResolvedResults]
          : [];

      this.processImmediateChampionMutations(context);

      context._intermediateSnapshot = snapshotChampions(
        this.combat.activeChampions,
      );

      const registeredResults = context.consumeRegisteredResults();

      return {
        executed: true,
        user,
        skill: claimSkill,
        context,
        action,
        results: [
          {
            log: `${formatChampionName(user)} usou <b>CLAIM</b> e marcou ${claimPoints} ponto(s).`,
          },
          ...normalizedActionResolvedResults,
          ...registeredResults,
        ],
        claimPoints,
        scorePayload: this.match.getScorePayload(),
        scoringSlot,
        scoringTeam: user.team,
      };
    } finally {
      this.combat.activeChampions.forEach((champion) => {
        if (champion.runtime) delete champion.runtime.currentContext;
      });
      delete context.actionSource;
    }
  }

  // ============================================================
  //  MUTAÇÕES IMEDIATAS DE CAMPEÃO
  // ============================================================

  processImmediateChampionMutations(context) {
    const requests = context?.flags?.championMutationRequests;
    if (!Array.isArray(requests) || requests.length === 0) return;

    const deferredRequests = [];

    for (const request of requests) {
      if (!request || typeof request !== "object") continue;

      const shouldApplyImmediately =
        request.timing !== "postTurn" &&
        ["transform", "swap", "restore"].includes(request.mode);

      if (!shouldApplyImmediately) {
        deferredRequests.push(request);
        continue;
      }

      if (!this.mutationHandler) {
        deferredRequests.push(request);
        continue;
      }

      this.mutationHandler(request, { context, timing: "immediate" });
    }

    context.flags.championMutationRequests = deferredRequests;
  }

  // ============================================================
  //  VALIDAÇÃO DE AÇÃO (hooks podem negar)
  // ============================================================

  canExecuteAction(user, action) {
    if (!user || !user.alive) return { denied: true };

    const takingTheField = SpawnProtection.actionDenial(user);
    if (takingTheField) return takingTheField;

    const hardCCDenial = getHardCCActionDenial(user);
    if (hardCCDenial) {
      return hardCCDenial;
    }

    for (const champ of this.combat.activeChampions.values()) {
      console.log(
        "[actionExecution - DEBUG]",
        champ.name,
        champ.runtime.hookEffects,
      );
    }

    console.log(
      "[canExecuteAction] Validating action for",
      user.name,
      "hooks effects:",
      user.runtime?.hookEffects?.map((e) => e.key),
    );

    // Descobrir o alvo principal da ação (primeiro alvo válido)
    let mainTarget = null;
    if (action?.targetIds) {
      for (const targetId of Object.values(action.targetIds)) {
        const target = this.combat.activeChampions.get(targetId);
        if (target && target.alive) {
          mainTarget = target;
          break;
        }
      }
    }

    const results = emitCombatEvent(
      "onValidateAction",
      {
        actionSource: user,
        skill: action?.skill,
        target: mainTarget,
      },
      this.combat.activeChampions,
      {
        players: this.match.players,
      },
    );

    for (const res of results) {
      if (res?.deny) {
        return {
          denied: true,
          message:
            res.message ||
            res.log ||
            `${formatChampionName(user)} não pode agir.`,
        };
      }
    }

    if (action?.skillKey === CLAIM_ACTION_KEY) {
      const activeTaunt = user.tauntEffects?.find(
        (effect) => effect.expiresAtTurn > this.combat.currentTurn,
      );

      if (activeTaunt) {
        const taunter = this.combat.activeChampions.get(activeTaunt.taunterId);
        if (taunter?.alive) {
          return {
            denied: true,
            message: `${formatChampionName(user)} está provocado e deve atacar seu provocador.`,
          };
        }
      }
    }

    return { denied: false };
  }

  // ============================================================
  //  REEMBOLSO DE RECURSO
  // ============================================================

  refundActionResource(user, action) {
    if (!user || !action) return;
    const amount = Number(action.momentumCost) || 0;
    if (amount > 0) {
      user.addMomentum({ amount });
    }
  }

  // ============================================================
  //  EXECUÇÃO DE HABILIDADE
  // ============================================================

  performSkillExecution(user, skill, targets, context, action = null) {
    context.currentSkill = skill;
    context.actionSource = user;
    // Verificar executionIndex:
    console.log(
      `[performSkillExecution] executionIndex: ${context.executionIndex}`,
    );

    // 🔹 2. Injetar contexto nos campeões
    this.combat.activeChampions.forEach((champion) => {
      champion.runtime = champion.runtime || {};
      champion.runtime.currentContext = context;
    });

    if (!Array.isArray(targets)) {
      throw new Error(
        `[SKILL ERROR] ${skill.name} recebeu targets que não são array`,
      );
    }

    if (targets.length === 0) {
      throw new Error(`[SKILL ERROR] ${skill.name} recebeu targets vazio`);
    }

    for (const t of targets) {
      if (!t || typeof t !== "object" || !t.id) {
        throw new Error(`[SKILL ERROR] ${skill.name} recebeu target inválido`);
      }
    }

    let result;

    try {
      // 🔹 3. Executar skill - Passa o resolver (this) desacoplado do contexto
      result = skill.resolve({
        user,
        targets,
        context,
        resolver: this,
      });
    } finally {
      // 🔹 4. Limpar contexto
      this.combat.activeChampions.forEach((champion) => {
        if (champion.runtime) delete champion.runtime.currentContext;
      });
      delete context.actionSource;
    }

    // 🔹 5. Registrar no histórico do turno
    this.registerSkillUsageInTurn(user, skill, targets);

    // 🔹 6. Normalizar resultado
    const results = Array.isArray(result) ? result : result ? [result] : [];

    this.applyMomentumFromContext({ user, context });

    // 🔹 7. Hook onActionResolved
    const actionResolvedResults = emitCombatEvent(
      "onActionResolved",
      {
        actionSource: user,
        targets,
        skill,
        action,
        context,
      },
      this.combat.activeChampions,
    );

    const normalizedActionResolvedResults = Array.isArray(actionResolvedResults)
      ? actionResolvedResults
      : actionResolvedResults
        ? [actionResolvedResults]
        : [];

    const registeredResults = context.consumeRegisteredResults();

    return [
      ...results,
      ...normalizedActionResolvedResults,
      ...registeredResults,
    ];
  }

  // ============================================================
  //  REGISTRO DE USO DE HABILIDADE NO TURNO
  // ============================================================

  registerSkillUsageInTurn(user, skill, targets) {
    this.match.logTurnEvent("skillUsed", {
      championId: user.id,
      championName: user.name,
      skillKey: skill.key,
      skillName: skill.name,
      targetIds: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, v.id]),
      ),
      targetNames: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, v.name]),
      ),
    });

    const turnData = this.match.ensureTurnEntry();

    if (!turnData.skillsUsedThisTurn[user.id]) {
      turnData.skillsUsedThisTurn[user.id] = [];
    }

    turnData.skillsUsedThisTurn[user.id].push(skill.key);
  }

  // ============================================================
  //  APLICAÇÃO DE MOMENTUM PÓS-AÇÃO
  // ============================================================

  applyMomentumFromContext({ user, context }) {
    const damageEvents = context.visual.damageEvents || [];

    const damageDealtToEnemies = damageEvents.reduce((total, event) => {
      const target = event?.targetId
        ? this.combat.activeChampions.get(event.targetId)
        : null;

      if (!target || target.team === user.team) return total;

      return total + Math.max(0, Number(event.amount) || 0);
    }, 0);

    const userMomentumGain = getMomentumFromDamageDealt(damageDealtToEnemies);

    if (userMomentumGain > 0) {
      this.applyResourceChange({
        target: user,
        amount: userMomentumGain,
        context,
        sourceId: user.id,
        debugLabel: "damageDealt",
      });
    }

    const damagedTargets = new Map();

    for (const event of damageEvents) {
      if (!event?.targetId) continue;

      const amount = Math.max(0, Number(event.amount) || 0);
      if (amount <= 0) continue;

      damagedTargets.set(
        event.targetId,
        (damagedTargets.get(event.targetId) || 0) + amount,
      );
    }

    for (const [targetId, totalDamageTaken] of damagedTargets.entries()) {
      const target = this.combat.activeChampions.get(targetId);
      if (!target || !target.alive) continue;

      const momentumGain = getMomentumFromDamageTaken(totalDamageTaken);

      if (momentumGain <= 0) continue;

      this.applyResourceChange({
        target,
        amount: momentumGain,
        context,
        sourceId: user?.id,
        debugLabel: "damageTaken",
      });
    }
  }

  /**
   * Ponto único de entrada (Backend) para mudança de recursos com emissão de hooks.
   * Orquestra: Mudança de Estado (Champion) -> Visual (Context) -> Gameplay Hooks (Emitter).
   */
  applyResourceChange({
    target,
    amount,
    context,
    sourceId,
    emitHooks = true,
    visualPhase = null,
    visualAfterHooks = false,
    debugLabel = null,
  }) {
    const requestedAmount = Number(amount) || 0;
    if (!target || requestedAmount === 0) {
      return { applied: 0, hookResults: [] };
    }

    const beforeMomentum = Number(target.momentum) || 0;
    const sourceChampion = sourceId
      ? this.combat.activeChampions.get(sourceId) || null
      : null;

    // 1. Backend State Change (Champion)
    const applied =
      requestedAmount > 0
        ? target.addMomentum(requestedAmount)
        : target.spendMomentum(Math.abs(requestedAmount));

    const afterMomentum = Number(target.momentum) || 0;

    if (applied === 0) {
      logResourceDebug({
        stage: "applyResourceChange:blocked",
        sourceId: sourceId || null,
        sourceName: sourceChampion?.name || null,
        targetId: target.id,
        targetName: target.name,
        requestedAmount,
        beforeMomentum,
        afterMomentum,
        debugLabel,
      });
      return { applied: 0, hookResults: [] };
    }

    const eventType = applied > 0 ? "onResourceGain" : "onResourceSpend";
    const payloadType = applied > 0 ? "resourceGain" : "resourceSpend";

    logResourceDebug({
      stage: "applyResourceChange:applied",
      sourceId: sourceId || null,
      sourceName: sourceChampion?.name || null,
      targetId: target.id,
      targetName: target.name,
      requestedAmount,
      applied,
      eventType,
      payloadType,
      beforeMomentum,
      afterMomentum,
      emitHooks,
      visualPhase,
      visualAfterHooks,
      debugLabel,
    });

    const registerVisual = () =>
      context.registerResourceChange({
        target,
        amount: applied,
        sourceId,
        phase: visualPhase,
      });

    if (!visualAfterHooks) {
      // 2. Frontend Visual Registration (Context)
      registerVisual();
    }

    if (!emitHooks) {
      if (visualAfterHooks) registerVisual();
      return { applied, hookResults: [] };
    }

    // 3. Backend Gameplay Logic (Hooks)
    const hookResults = emitCombatEvent(
      eventType,
      {
        target,
        amount: Math.abs(applied),
        context,
        type: payloadType,
        resourceType: "momentum",
        source: this.combat.activeChampions.get(sourceId) || null,
        resolver: this, // Desacoplado do contexto, passado como bridge
      },
      this.combat.activeChampions,
    );

    const result = {
      type: payloadType,
      resourceType: "momentum",
      applied,
      targetId: target.id,
      sourceId: sourceId || null,
      hookResults,
    };

    context.registerResult?.(result);

    if (visualAfterHooks) {
      registerVisual();
    }

    return result;
  }

  // ============================================================
  // ============================================================
  //  RESOLUÇÃO DE ALVOS
  // ============================================================

  resolveSkillTargets(user, skill, action, context) {
    context ??= this.createBaseContext({ sourceId: action?.userId });

    const isUnavailable = (c) => !c || !c.alive;

    const targets =
      this._resolveTauntTargets(user, skill, action, context, isUnavailable) ??
      this._resolveAoETargets(user, skill, isUnavailable) ??
      this._resolveDirectTargets(user, action, isUnavailable);

    return targets && Object.keys(targets).length > 0 ? targets : null;
  }

  _resolveTauntTargets(user, skill, action, context, isUnavailable) {
    const activeTaunt = user.tauntEffects?.find(
      (e) => e.expiresAtTurn > this.combat.currentTurn,
    );

    if (
      !activeTaunt ||
      !action?.targetIds ||
      Object.keys(action.targetIds).length === 0
    )
      return null;
    if (!Array.isArray(skill.targetSpec)) return null;

    const taunter = this.combat.activeChampions.get(activeTaunt.taunterId);
    if (isUnavailable(taunter)) return null;

    const targets = {};
    const redirectionEvents = [];
    let redirected = false;

    skill.targetSpec.forEach((spec, index) => {
      const type = typeof spec === "string" ? spec : spec.type;
      if (type !== "enemy") return;

      const roleKey = index === 0 ? "enemy" : `enemy${index + 1}`;
      const originalId = action.targetIds?.[roleKey];
      if (!originalId) return;

      const original = this.combat.activeChampions.get(originalId);
      if (isUnavailable(original)) return;
      if (spec.unique === true) return;

      targets[roleKey] = taunter;
      redirected = true;
      redirectionEvents.push({
        seq: context.visual.seq++,
        type: "tauntRedirection",
        attackerId: user.id,
        fromTargetId: original.id,
        toTargetId: taunter.id,
      });
    });

    if (!redirected) return null;

    // Fill in roles that weren't redirected with the original targets
    for (const role in action.targetIds) {
      if (!targets[role]) {
        const target = this.combat.activeChampions.get(action.targetIds[role]);
        if (!isUnavailable(target)) targets[role] = target;
      }
    }

    context.visual.redirectionEvents = context.visual.redirectionEvents || [];
    context.visual.redirectionEvents.push(...redirectionEvents);

    return targets;
  }

  _resolveAoETargets(user, skill, isUnavailable) {
    const normalizedSpec = Array.isArray(skill.targetSpec)
      ? skill.targetSpec.map((s) => (typeof s === "string" ? s : s.type))
      : [];

    const hasAll = normalizedSpec.includes("all");
    const hasAllEnemies =
      normalizedSpec.includes("all-enemies") ||
      normalizedSpec.includes("all:enemy");
    const hasAllAllies =
      normalizedSpec.includes("all-allies") ||
      normalizedSpec.includes("all:ally");

    if (!hasAll && !hasAllEnemies && !hasAllAllies) return null;

    const targets = {};

    if (hasAllEnemies || hasAll) {
      Array.from(this.combat.activeChampions.values())
        .filter((c) => c.team !== user.team && !isUnavailable(c))
        .forEach((enemy, i) => {
          targets[i === 0 ? "enemy" : `enemy${i + 1}`] = enemy;
        });
    }

    if (hasAllAllies || hasAll) {
      Array.from(this.combat.activeChampions.values())
        .filter((c) => c.team === user.team && !isUnavailable(c))
        .forEach((ally, i) => {
          targets[i === 0 ? "ally" : `ally${i + 1}`] = ally;
        });
    }

    return targets;
  }

  _resolveDirectTargets(user, action, isUnavailable) {
    if (!action?.targetIds) return null;

    const targets = {};
    for (const role in action.targetIds) {
      const target = this.combat.activeChampions.get(action.targetIds[role]);
      if (!isUnavailable(target)) {
        targets[role] = target;
      } else if (role === "self") {
        targets[role] = user;
      }
    }
    return targets;
  }

  // ============================================================
  //  CRIAÇÃO DE CONTEXTO BASE
  // ============================================================

  createBaseContext({ sourceId = null } = {}) {
    const aliveChampionsArray = [
      ...this.combat.activeChampions.values(),
    ].filter((c) => c.alive);

    const combat = this.combat;
    const editMode = this.editMode;

    return {
      currentTurn: combat.currentTurn,
      editMode,
      allChampions: combat.activeChampions,
      aliveChampions: aliveChampionsArray,
      // eventIndex: 0, // para controle interno de ordem de eventos dentro da resolução de uma ação
      players: this.match.players,

      // ========================
      // EVENT BUFFERS
      // ========================
      visual: {
        damageEvents: [],
        healEvents: [],
        lifestealEvents: [],
        buffEvents: [],
        resourceEvents: [],
        shieldEvents: [],
        redirectionEvents: [],
        // fallback (keeps compatibility)
        globalDialogs: [],
        // 🔢 Global sequence counter: preserves the real chronological order
        // in which events were registered inside the skill's resolve(),
        // regardless of category (damage, buff, heal, etc).
        seq: 0,
      },

      _lastEventRef: null, // referência para o último evento registrado, útil para diálogos que precisam se referir a ele

      registeredResults: [],

      repeatActionRequest: null,
      flags: {},

      healSourceId: sourceId,
      statModifierSrcId: sourceId,

      requestChampionMutation(request) {
        if (!request || typeof request !== "object") return null;

        this.flags.championMutationRequests ??= [];
        this.flags.championMutationRequests.push(request);

        return request;
      },

      registerResult(result) {
        if (!result) return null;

        if (Array.isArray(result)) {
          for (const entry of result) {
            this.registerResult(entry);
          }
          return result;
        }

        this.registeredResults.push(result);
        return result;
      },

      registerScore({
        amount = 0,
        scoringSlot = null,
        reason = null,
        sourceId = null,
      } = {}) {
        const value = Number(amount) || 0;
        if (value <= 0) return null;

        if (scoringSlot !== 0 && scoringSlot !== 1) {
          throw new Error(`[SCORE ERROR] scoringSlot inválido: ${scoringSlot}`);
        }

        return this.registerResult({
          type: "score",
          amount: value,
          scoringSlot,
          reason,
          sourceId,
        });
      },

      // Hooks emitted from inside a registry (onAfterHealing, for one) have
      // nowhere to return their logs to, since nothing reads the emit's result.
      // Routing them through registerResult puts them in the action's results,
      // which is what the battle log is built from.
      registerHookLogs(hookResults) {
        for (const hookResult of hookResults) {
          if (hookResult?.log) this.registerResult({ log: hookResult.log });
        }
      },

      consumeRegisteredResults() {
        if (!this.registeredResults.length) return [];

        const results = [...this.registeredResults];
        this.registeredResults.length = 0;
        return results;
      },

      schedule(scheduledEffect) {
        combat.scheduledEffects.push(scheduledEffect);
      },

      getTeamLine(team, options = {}) {
        return combat.getTeamLine(team, options);
      },

      getAdjacentChampions(target, { side } = {}) {
        return combat.getAdjacentChampions(target, { side });
      },

      // nextEventIndex() {
      //   return this.eventIndex++;
      // },

      // ========================
      // REGISTRIES
      // ========================
      // -- DAMAGE REGISTRY -- //
      registerDamage({
        target,
        amount,
        rawAmount,
        absorbedByShield,
        remainingShield,
        sourceId,
        isCritical = false,
        damageDepth = 0,
        isDot = false,
        flags,
      } = {}) {
        if (!target?.id) return;

        const sourceChamp = sourceId
          ? combat.activeChampions.get(sourceId)
          : null;
        const dealt = Math.max(0, Number(amount) || 0);
        const rawCandidate = Number(rawAmount);
        const raw = Number.isFinite(rawCandidate)
          ? Math.max(0, rawCandidate)
          : dealt;

        sourceChamp?.addDamageDealt?.(dealt);
        target?.addRawDamageTaken?.(raw);
        target?.addDamageMitigated?.(Math.max(0, raw - dealt));

        if (target?.id && target.runtime) {
          target.runtime.lastDamageSourceId = sourceId ?? null;
        }

        this._lastEventRef = null;

        const finishingType =
          flags?.finishingType ?? (flags?.finishing ? "regular" : null);

        const hasFinishing = !!finishingType;

        const event = {
          seq: this.visual.seq++,
          type: "damage",
          sourceId: sourceId || null,
          targetId: target.id,
          amount,
          rawAmount: Number.isFinite(rawAmount) ? rawAmount : null,
          absorbedByShield: Number.isFinite(absorbedByShield)
            ? absorbedByShield
            : null,
          remainingShield: Number.isFinite(remainingShield)
            ? remainingShield
            : null,
          isCritical: !!isCritical,
          isDot: !!isDot,
          damageDepth: damageDepth || 0,
          evaded: flags?.evaded,
          immune: !!flags?.immune,
          immuneMessage: flags?.immuneMessage ?? null,
          shieldBlocked: !!flags?.shieldBlocked,
          finishing: hasFinishing,
          finishingType,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.damageEvents.push(event);
        this._lastEventRef = event; // reference for dialogs possibly related to this damage
      },

      // -- HEAL REGISTRY -- //
      registerHeal({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.healSourceId) ||
          target;

        target?.addHealingReceived?.(value);
        sourceChamp?.addHealingDone?.(value);

        this._lastEventRef = null;

        const event = {
          seq: this.visual.seq++,
          type: "heal",
          targetId: target.id,
          sourceId: sourceChamp?.id || target.id,
          amount: value,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.healEvents.push(event);
        this._lastEventRef = event; // reference for dialogs possibly related to this heal

        // 🔥 Fires the heal hook
        this.registerHookLogs(
          emitCombatEvent(
            "onAfterHealing",
            {
              healSrc: sourceChamp || null,
              healTarget: target,
              amount: value,
              context: this,

              healType: "normal",
              isLifesteal: false,
            },
            this.allChampions,
          ),
        );
      },

      registerLifesteal({
        target,
        amount,
        sourceId,
        fromTargetId = null,
      } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.healSourceId) ||
          target;

        target?.addHealingReceived?.(value);

        this._lastEventRef = null;

        this.registerHookLogs(
          emitCombatEvent(
            "onAfterHealing",
            {
              healSrc: sourceChamp || null,
              healTarget: target,
              amount: value,
              context: this,

              healType: "lifesteal",
              isLifesteal: true,
              fromTargetId,
            },
            this.allChampions,
          ),
        );

        const event = {
          seq: this.visual.seq++,
          type: "lifesteal",
          targetId: target.id,
          sourceId: sourceChamp?.id || target.id,
          fromTargetId,
          amount: value,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.lifestealEvents.push(event);
        this._lastEventRef = event;
      },

      // -- BUFF REGISTRY -- //
      registerBuff({ target, amount, statName, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value === 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.statModifierSrcId) ||
          target;

        this._lastEventRef = null;

        // Keeps previous UI/ult behavior: only positive gains enter buffEvents
        if (value > 0) {
          const event = {
            seq: this.visual.seq++,
            type: "buff",
            targetId: target.id,
            sourceId: sourceChamp?.id || target.id,
            amount: value,
            statName,
            preDialogs: [],
            postDialogs: [],
          };

          this.visual.buffEvents.push(event);
          this._lastEventRef = event;
        } else {
          this._lastEventRef = null; // negative changes don't generate a visual event, so clear the reference to avoid wrong dialog associations
        }

        this.registerHookLogs(
          emitCombatEvent(
            "onBuffingStat",
            {
              buffSrc: sourceChamp || null,
              buffTarget: target,
              statName,
              amount: value,
              context: this,
            },
            this.allChampions,
          ),
        );
      },

      // -- SHIELD REGISTRY -- //
      registerShield({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        this._lastEventRef = null;

        const event = {
          seq: this.visual.seq++,
          type: "shield",
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: value,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.shieldEvents.push(event);
        this._lastEventRef = event;
      },
      // -- RESOURCE REGISTRY (Visual Only) -- //
      registerResourceChange({ target, amount, sourceId, phase = null } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value === 0) return 0;

        const eventType = value > 0 ? "resourceGain" : "resourceSpend";

        const event = {
          seq: this.visual.seq++,
          type: eventType,
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: Math.abs(value),
          resourceType: "momentum",
          phase,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.resourceEvents.push(event);
        this._lastEventRef = event;

        logResourceDebug({
          stage: "registerResourceChange",
          targetId: target.id,
          targetName: target.name,
          sourceId: event.sourceId,
          eventType,
          amount: Math.abs(value),
          phase,
        });

        return value;
      },

      // -- DIALOG REGISTRY -- //
      registerDialog({
        message,
        timing = "pre",
        sourceId = null,
        targetId = null,
        duration = null,
      } = {}) {
        if (!message) return;

        const dialogObj = {
          message,
          sourceId,
          targetId,
          duration,
        };

        if (this._lastEventRef) {
          const key = timing === "post" ? "postDialogs" : "preDialogs";

          this._lastEventRef[key] ??= []; // 🔥 garante array
          this._lastEventRef[key].push(dialogObj);
        } else {
          // fallback global
          this.visual.globalDialogs ??= [];
          this.visual.globalDialogs.push(dialogObj);
        }
      },
    };
  }
}
