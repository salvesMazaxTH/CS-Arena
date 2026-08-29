// Import status effect methods
import {
  applyStatusEffect,
  getActionBlockingHardCCEffects,
  getHardCCActionDenial,
  hasStatusEffect,
  getStatusEffect,
  getStatusEffectData,
  getStatusEffects,
  isActionBlockedByHardCC,
  removeStatusEffect,
  purgeExpiredStatusEffects,
} from "./championStatus.js";

// Import combat methods
import {
  roundToFive,
  addShield,
  _checkAndConsumeShieldBlock,
  applyTaunt,
  isTauntedBy,
  applyDamageReduction,
  getTotalDamageReduction,
  applyStatModifier,
  buffStat,
  debuffStat,
  modifyStat,
  modifyHP,
  takeDamage,
  heal,
  removeStatModifiers,
  purgeExpiredStatModifiers,
  purgeExpiredHookEffects,
  addHookEffect,
  addDamageModifier,
  purgeExpiredModifiers,
  getDamageModifiers,
} from "./championCombat.js";

// Import UI methods
import {
  renderChampion,
  updateChampionUI,
  syncChampionActionStateUI,
  destroyChampion,
} from "./championUI.js";

import { formatChampionName } from "../ui/formatters.js";
import { resolveElementalStatusImmunity } from "../engine/combat/statusEffectImmunity.js";

export class Champion {
  constructor(data = {}) {
    const {
      identity = {},
      stats = {},
      combat = {},
      runtime = {},
      matchStats = {},
    } = data;

    // IDENTIDADE
    this.id = identity.id;
    this.name = identity.name;
    this.portrait = identity.portrait;
    this.team = identity.team;
    this.combatSlot = Number.isInteger(identity.combatSlot)
      ? identity.combatSlot
      : null;
    this.classKey = identity.classKey ?? null;
    this.species = Array.isArray(identity.species)
      ? Array.from(identity.species)
      : [];
    this.elementalAffinities = Array.from(identity.elementalAffinities) || [];
    this.entityType = identity.entityType ?? "champion";

    // STATS
    // Stats atuais
    this.HP = stats.HP;
    this.maxHP = stats.HP;
    this.Attack = stats.Attack;
    this.Defense = stats.Defense;
    this.Speed = stats.Speed;
    this.Evasion = stats.Evasion ?? 0;
    this.Critical = stats.Critical ?? 0;
    this.LifeSteal = stats.LifeSteal ?? 0;
    // Base Stats (ESSENCIAL)
    this.baseHP = stats.HP;
    this.baseAttack = stats.Attack;
    this.baseDefense = stats.Defense;
    this.baseSpeed = stats.Speed;
    this.baseEvasion = stats.Evasion ?? 0;
    this.baseCritical = stats.Critical ?? 0;
    this.baseLifeSteal = stats.LifeSteal ?? 0;

    this.momentumMax = 100;
    this.momentum = 0;

    this.initializeResources(stats);

    // COMBATE
    this.skills = combat.skills;
    this.passive = combat.passive || null;
    this.damageModifiers = [];
    this.statModifiers = [];
    this.tauntEffects = [];
    this.damageReductionModifiers = [];
    this.statusEffects = new Map();
    this.alive = true;
    this.hasActedThisTurn = false;

    // RUNTIME
    this.runtime = this.buildRuntime(runtime);

    // MATCH STATS (backend authoritative)
    this.matchStats = this.buildMatchStats(matchStats);
  }

  static fromBaseData(baseData, id, team, { combatSlot = null } = {}) {
    const champ = new Champion({
      identity: {
        id,
        name: baseData.name,
        portrait: baseData.portrait,
        team,
        combatSlot,
        entityType: baseData.entityType,
        classKey: baseData.classKey,
        species: baseData.species || [],
        elementalAffinities: baseData.elementalAffinities || [],
      },

      stats: {
        HP: baseData.HP,
        Attack: baseData.Attack,
        Defense: baseData.Defense,
        Speed: baseData.Speed,
        Evasion: baseData.Evasion,
        Critical: baseData.Critical,
        LifeSteal: baseData.LifeSteal,
        momentum: baseData.momentum,
        momentumMax: baseData.momentumMax,
      },

      combat: {
        skills: baseData.skills.map((s) => ({ ...s })),
        passive: baseData.passive,
      },
    });

    champ.runtime ??= {};
    champ.runtime.hookEffects ??= [];

    // Lets a champion definition seed runtime state that must exist from the
    // very first turn (e.g. Zyrelle's starting ammo), rather than only
    // appearing once some skill or onTurnStart hook first touches it.
    if (baseData.initialRuntime) {
      Object.assign(champ.runtime, baseData.initialRuntime);
    }

    if (champ.elementalAffinities?.length) {
      champ.runtime.hookEffects.push({
        type: "buff",
        key: "elemental_affinity_immunity",
        group: "system",

        hookScope: {
          onStatusEffectIncoming: "target",
        },

        onStatusEffectIncoming({ target, statusEffect }) {
          const immunity = resolveElementalStatusImmunity({
            target,
            statusEffect,
          });

          if (immunity) {
            return {
              cancel: true,
              message: `${formatChampionName(target)} is immune to <b>${statusEffect.name}</b>!`,
            };
          }
        },
      });
    }

    return champ;
  }

  // Método para serializar o estado do campeão
  serialize() {
    return {
      id: this.id,
      championKey:
        this.championKey ??
        (typeof this.id === "string" && this.id.includes("-")
          ? this.id.split("-")[0]
          : this.name),

      team: this.team,
      combatSlot: this.combatSlot,

      name: this.name,
      portrait: this.portrait,
      entityType: this.entityType,
      classKey: this.classKey,
      species: Array.isArray(this.species) ? [...this.species] : [],

      passive: {
        name: this.passive?.name ?? null,
        description: (() => {
          const d = this.passive?.description;
          if (!d) return "";
          return typeof d === "function"
            ? d.call(this.passive, this)
            : String(d);
        })(),
      },

      HP: this.HP,
      maxHP: this.maxHP,
      Attack: this.Attack,
      Defense: this.Defense,
      Speed: this.Speed,
      Evasion: this.Evasion,
      Critical: this.Critical,
      LifeSteal: this.LifeSteal,
      momentum: this.momentum,
      momentumMax: this.momentumMax,
      matchStats: this.getMatchStatsSnapshot(),

      runtime: (() => {
        const clone = { ...this.runtime };

        delete clone.hookEffects;
        delete clone.currentContext;

        // Strip functions and object references that could cause circular refs
        for (const k of Object.keys(clone)) {
          const v = clone[k];
          if (typeof v === "function") {
            delete clone[k];
          } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            // Allow only plain-data objects (shields array is fine via Array.isArray above)
            // Deep-clone to sever any live references
            try {
              clone[k] = JSON.parse(JSON.stringify(v));
            } catch {
              delete clone[k];
            }
          }
        }

        return clone;
      })(),

      // Data-only view of the hooks for client-side indicators.
      // Never serialize hook functions or full hook objects.
      runtimeHookEffectData: (() => {
        const hooks = Array.isArray(this.runtime?.hookEffects)
          ? this.runtime.hookEffects
          : [];

        return hooks
          .filter((effect) => typeof effect?.key === "string")
          .map((effect) => ({
            key: effect.key.toLowerCase(),
            stacks: effect.stacks ?? 0,
          }));
      })(),

      actionBlockedByHardCC: this.isActionBlockedByHardCC(),

      statusEffects: Array.from(this.statusEffects.entries()).map(
        ([key, value]) => {
          const safeValue = { ...value };

          // Strip raw metadata (may contain live champion/context references)
          delete safeValue.metadata;

          if (safeValue.source && typeof safeValue.source === "object") {
            safeValue.source = {
              id: safeValue.source.id,
              name: safeValue.source.name,
            };
          }

          // Strip functions (hooks not needed by client)
          for (const k of Object.keys(safeValue)) {
            if (typeof safeValue[k] === "function") {
              delete safeValue[k];
            }
          }

          return [key, safeValue];
        },
      ),

      // Modifier counts for UI indicators (buff/debuff arrows)
      statModifiers: (this.statModifiers || []).map((m) => ({
        amount: m.amount,
        statName: m.statName,
        isPermanent: m.isPermanent,
      })),
      damageModifiersCount: (this.damageModifiers || []).length,
      damageReductionModifiersCount: (this.damageReductionModifiers || [])
        .length,

      // Taunt effects for UI indicator (provocação)
      tauntEffects: (this.tauntEffects || []).map((t) => ({
        taunterId: t.taunterId,
        expiresAtTurn: t.expiresAtTurn,
      })),
    };
  }

  // ===============================
  // ======== MOMENTUM CORE ========
  // ===============================

  getResourceState() {
    return {
      type: "momentum",
      currentKey: "momentum",
      current: this.momentum,
      max: this.momentumMax,
    };
  }

  initializeResources(stats = {}) {
    const { momentum = 0 } = stats;

    this.momentum = Math.max(
      0,
      Math.min(this.momentumMax, Math.round(momentum)),
    );
  }

  // Operações públicas
  getSkillCost(skill) {
    if (!skill) return 0;
    if (skill.isUltimate !== true) return 0;
    // A skill may ramp its own cost per use; otherwise the flat momentumCost stands.
    const cost =
      typeof skill.getMomentumCost === "function"
        ? skill.getMomentumCost(this)
        : skill.momentumCost;
    if (!Number.isInteger(cost) || cost <= 0) return 0;
    return cost;
  }

  addMomentum(input) {
    const amount = typeof input === "object" ? input.amount : Number(input);
    if (!Number.isInteger(amount) || amount <= 0) return 0;

    return this._applyMomentumDelta(amount);
  }

  spendMomentum(cost) {
    const amount = Math.abs(Number(cost) || 0);
    if (this.momentum < amount) return 0;

    return this._applyMomentumDelta(-amount);
  }

  // Núcleo interno
  _applyMomentumDelta(delta) {
    /* console.log(
      "APPLY DELTA",
      this.name,
      "instance:",
      this.id,
      "delta:",
      delta,
      "antes:",
      this.momentum,
    );
    */
    if (!Number.isInteger(delta) || delta === 0) return 0;

    const next = Math.max(0, Math.min(this.momentumMax, this.momentum + delta));
    const applied = next - this.momentum;

    this.momentum = next;
    return applied;
  }

  // ===============================
  // ======== RUNTIME ========
  // ===============================

  buildRuntime(runtime = {}) {
    return {
      ...runtime,
      shields: Array.isArray(runtime?.shields) ? runtime.shields : [],
      resourceRegenMultiplier: Number.isFinite(runtime?.resourceRegenMultiplier)
        ? runtime.resourceRegenMultiplier
        : 1,
      resourceRegenFlatBonus: Number.isFinite(runtime?.resourceRegenFlatBonus)
        ? runtime.resourceRegenFlatBonus
        : 0,
    };
  }

  // ===============================
  // ======== MATCH STATS ==========
  // ===============================

  buildMatchStats(matchStats = {}) {
    return {
      damage: Number(matchStats.damage) || 0,
      healingReceived: Number(matchStats.healingReceived) || 0,
      healingDone: Number(matchStats.healingDone) || 0,
      rawTaken: Number(matchStats.rawTaken) || 0,
      damageMitigated: Number(matchStats.damageMitigated) || 0,
    };
  }

  getMatchStatsSnapshot() {
    return {
      damage: Number(this.matchStats?.damage) || 0,
      healingReceived: Number(this.matchStats?.healingReceived) || 0,
      healingDone: Number(this.matchStats?.healingDone) || 0,
      rawTaken: Number(this.matchStats?.rawTaken) || 0,
      damageMitigated: Number(this.matchStats?.damageMitigated) || 0,
    };
  }

  resetMatchStats() {
    this.matchStats = this.buildMatchStats();
  }

  addDamageDealt(value) {
    this.matchStats.damage += Math.max(0, Number(value) || 0);
  }

  addHealingReceived(value) {
    this.matchStats.healingReceived += Math.max(0, Number(value) || 0);
  }

  addHealingDone(value) {
    this.matchStats.healingDone += Math.max(0, Number(value) || 0);
  }

  addRawDamageTaken(value) {
    this.matchStats.rawTaken += Math.max(0, Number(value) || 0);
  }

  addDamageMitigated(value) {
    this.matchStats.damageMitigated += Math.max(0, Number(value) || 0);
  }

  // ===============================
  // ======== STATUS EFFECTS (Delegated) ========
  // ===============================

  applyStatusEffect(
    statusEffectKey,
    duration,
    context,
    metadata = {},
    stackCount = 1,
  ) {
    return applyStatusEffect(
      this,
      statusEffectKey,
      duration,
      context,
      metadata,
      stackCount,
    );
  }

  hasStatusEffect(statusEffectKey) {
    return hasStatusEffect(this, statusEffectKey);
  }

  getStatusEffectData(statusEffectKey) {
    return getStatusEffectData(this, statusEffectKey);
  }

  getStatusEffect(statusEffectKey) {
    return getStatusEffect(this, statusEffectKey);
  }

  getStatusEffects(options = {}) {
    return getStatusEffects(this, options);
  }

  getActionBlockingHardCCEffects() {
    return getActionBlockingHardCCEffects(this);
  }

  getHardCCActionDenial() {
    return getHardCCActionDenial(this);
  }

  isActionBlockedByHardCC() {
    return isActionBlockedByHardCC(this);
  }

  removeStatusEffect(statusEffectKey) {
    return removeStatusEffect(this, statusEffectKey);
  }

  addHookEffect(hookEffect, context) {
    return addHookEffect(this, hookEffect, context);
  }

  purgeExpiredStatusEffects(currentTurn, context) {
    return purgeExpiredStatusEffects(this, currentTurn, context);
  }

  // ===============================
  // ======== ACTION MARKING ========
  // ===============================

  markActionTaken() {
    this.hasActedThisTurn = true;
  }

  resetActionStatus() {
    this.hasActedThisTurn = false;
    this.syncActionStateUI();
  }

  // ===============================
  // ======== COMBAT (Delegated) ====
  // ===============================

  roundToFive(x) {
    return roundToFive(x);
  }

  modifyStat(config = {}) {
    return modifyStat(this, config);
  }

  applyStatModifier(config = {}) {
    return applyStatModifier(this, config);
  }

  buffStat(config = {}) {
    return buffStat(this, config);
  }

  debuffStat(config = {}) {
    return debuffStat(this, config);
  }

  modifyHP(amount, config = {}) {
    return modifyHP(this, amount, config);
  }

  _checkAndConsumeShieldBlock(context, damageType) {
    return _checkAndConsumeShieldBlock(this, context, damageType);
  }

  addShield(amount, decayPerTurn = 0, context, type = "regular", extra = {}) {
    return addShield(this, amount, decayPerTurn, context, type, extra);
  }

  applyTaunt(taunterId, duration, context) {
    return applyTaunt(this, taunterId, duration, context);
  }

  isTauntedBy(taunterId) {
    return isTauntedBy(this, taunterId);
  }

  applyDamageReduction(config) {
    if (typeof config !== "object") {
      throw new Error(`[applyDamageReduction] config inválido: ${config}`);
    }
    return applyDamageReduction(this, config);
  }

  getTotalDamageReduction(currentTurn) {
    return getTotalDamageReduction(this, currentTurn);
  }

  removeStatModifiers(modifiers) {
    return removeStatModifiers(this, modifiers);
  }

  purgeExpiredStatModifiers(currentTurn) {
    return purgeExpiredStatModifiers(this, currentTurn);
  }

  purgeExpiredHookEffects(currentTurn) {
    return purgeExpiredHookEffects(this, currentTurn);
  }

  takeDamage(amount, context) {
    return takeDamage(this, amount, context);
  }

  heal(amount) {
    return heal(this, amount);
  }

  addDamageModifier(mod) {
    return addDamageModifier(this, mod);
  }

  purgeExpiredModifiers(currentTurn) {
    return purgeExpiredModifiers(this, currentTurn);
  }

  getDamageModifiers() {
    return getDamageModifiers(this);
  }

  // ===============================
  // ======== UI (Delegated) ========
  // ===============================

  render(container, handlers = {}) {
    return renderChampion(this, container, handlers);
  }

  updateUI(context) {
    return updateChampionUI(this, context);
  }

  syncActionStateUI() {
    return syncChampionActionStateUI(this);
  }

  destroy() {
    return destroyChampion(this);
  }
}
