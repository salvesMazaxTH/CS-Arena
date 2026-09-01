import { formatChampionName } from "../../../shared/ui/formatters.js";

import { syncChampionVFX } from "../../../shared/vfx/vfxManager.js";
import { playFinishingEffect } from "../../../shared/vfx/finishing.js";
import { playLifestealTransferVFX } from "../../../shared/vfx/lifestealTransferCanvas.js";
import { StatusIndicator } from "../../../shared/ui/statusIndicator.js";
import { playDeathClaimEffect } from "../../../shared/vfx/deathClaim.js";
import { CLAIM_ACTION_KEY } from "../../../shared/engine/combat/claim.js";
import { audioManager } from "../utils/AudioManager.js";
import { animateSkill } from "./skillAnimations.js";
import { EffectCanvasBatch } from "./effectCanvasBatch.js";
import { createMatchStatsPanel } from "../ui/matchStats.js";
import { createScoreboard } from "../ui/scoreboard.js";

// ============================================================
//  AnimsAndLogManager.js — Combat Animation & Log System (v2)
//
//  Queue-based, deterministic animation system.
//  Receives structured combat action envelopes from the server
//  and plays effects sequentially with proper visual ordering.
//
//  Architecture:
//    Server emits "combatAction" envelopes with:
//      { action, effects[], log, state[] }
//    This manager queues them and processes one at a time.
//    Each effect is animated before the next begins.
//    Final state is applied only after all effects are animated.
// ============================================================

// ============================================================
//  TIMING CONSTANTS (derived from CSS keyframe durations)
// ============================================================

const TIMING = {
  // Float element lifetime (auto-removed after CSS animation)
  FLOAT_LIFETIME: 1900,

  // Death collapse animation
  DEATH_ANIM: 2000,

  // Combat dialog bubble
  DIALOG_DISPLAY: 2350, // Reduced from 1200
  DIALOG_LEAVE: 160, // Reduced from 180

  // Sequencing gaps
  BETWEEN_EFFECTS: 60, // Reduced from 120
  BETWEEN_ACTIONS: 60, // Reduced from 60
  RESOURCE_PHASE_GAP: 260,

  DEATH_CLAIM_EFFECT: 5600,
};

// Snapshot fields copied verbatim onto the champion (no side effects).
// Fields with extra logic (HP/alive, entityType, name) are handled apart.
const SNAPSHOT_PASSTHROUGH_KEYS = [
  "maxHP",
  "Attack",
  "Defense",
  "Speed",
  "Evasion",
  "Critical",
  "LifeSteal",
  "momentum",
  "passive",
  "statModifiers",
  "damageModifiersCount",
  "damageReductionModifiersCount",
];

// ============================================================
//  DAMAGE TIER CLASSIFICATION (maps to CSS .damage-tier-N)
// ============================================================

function getDamageTier(amount) {
  if (amount >= 251) return 6;
  if (amount >= 151) return 5;
  if (amount >= 101) return 4;
  if (amount >= 61) return 3;
  if (amount >= 31) return 2;
  return 1;
}

// ============================================================
//  UTILITY
// ============================================================

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVisualHpState(hpText) {
  if (typeof hpText !== "string") return null;

  const hpMatch = hpText.match(/^(\d+)\/(\d+)/);
  if (!hpMatch) return null;

  const shieldMatch = hpText.match(/🛡️\s*\((\d+)\)/);

  return {
    currentHP: parseInt(hpMatch[1], 10),
    maxHP: parseInt(hpMatch[2], 10),
    shield: shieldMatch ? parseInt(shieldMatch[1], 10) : 0,
  };
}

function getChampionElement(championId) {
  return document.querySelector(`.champion[data-champion-id="${championId}"]`);
}

// Reads an action envelope and mounts a rotating ring on every champion the
// skill touches: gold on the caster, red on those it harms, green on those it
// benefits. A skill that only helps its own caster gets no green ring — the
// gold ring and the stat-buff animation already read as "acted on itself".
// Returns a teardown that fades the rings out.
function applySkillAffectGlows(envelope) {
  const userId = envelope.action?.userId ?? null;

  const harm = new Set();
  const boon = new Set();

  for (const ev of envelope.damageEvents ?? []) {
    if (ev?.targetId) harm.add(ev.targetId);
  }
  for (const ev of envelope.lifestealEvents ?? []) {
    if (ev?.fromTargetId) harm.add(ev.fromTargetId);
    if (ev?.targetId) boon.add(ev.targetId);
  }
  for (const key of ["healEvents", "shieldEvents", "buffEvents"]) {
    for (const ev of envelope[key] ?? []) {
      if (ev?.targetId) boon.add(ev.targetId);
    }
  }

  boon.delete(userId);
  for (const id of harm) boon.delete(id);
  harm.delete(userId);

  const mounted = [];
  const mount = (championId, variant) => {
    const championEl = getChampionElement(championId);
    if (!championEl) return;
    const glow = document.createElement("div");
    glow.className = `skill-affect-glow skill-affect-glow--${variant}`;
    championEl.appendChild(glow);
    mounted.push(glow);
  };

  if (userId) mount(userId, "user");
  for (const id of harm) mount(id, "harm");
  for (const id of boon) mount(id, "boon");

  return () => {
    for (const glow of mounted) {
      glow.classList.add("is-leaving");
      setTimeout(() => glow.remove(), 300);
    }
  };
}

function scrollIfNeeded(
  el,
  {
    threshold = 0.6, // fraction of the element that must be visible (0 to 1)
    behavior = "smooth",
  } = {},
) {
  const rect = el.getBoundingClientRect();

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, viewportHeight);

  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const elementHeight = rect.height || 1;

  const visibilityRatio =
    visibleHeight / Math.min(elementHeight, viewportHeight);

  if (visibilityRatio < threshold) {
    if (rect.top < 0) {
      el.scrollIntoView({ behavior, block: "start" });
    } else if (rect.bottom > viewportHeight) {
      el.scrollIntoView({ behavior, block: "end" });
    }
  }
}

// ============================================================
//  FACTORY
// ============================================================

/**
 * Creates the combat animation manager.
 *
 * @param {object} deps
 * @param {Map}      deps.activeChampions
 * @param {Function} deps.createNewChampion
 * @param {Function} deps.getCurrentTurn
 * @param {Function} deps.setCurrentTurn
 * @param {Function} deps.applyTurnUpdate
 * @param {Function} deps.syncStatusIndicatorRotation
 * @param {Element}  deps.combatDialog
 * @param {Element}  deps.combatDialogText
 */
export function createCombatAnimationManager(deps) {
  // ============================================================
  //  QUEUE STATE
  // ============================================================

  const queue = [];
  const { onQueueEmpty } = deps;
  let processing = false;
  let lastLoggedTurn = null;
  let currentPhase = null;
  let activeDialogController = null;
  let lastDamageAnimationTime = 0; // 🛡️ Track when damage was last animated
  const editMode = deps.editMode || { freeCostSkills: false };
  const matchStats = createMatchStatsPanel({
    activeChampions: deps.activeChampions,
  });
  const scoreboard = createScoreboard();

  // Double-click in any area of the screen accelerates only the current dialog.
  document.addEventListener("click", () => {
    if (activeDialogController) {
      activeDialogController.requestSkip();
    }
  });

  // ============================================================
  //  QUEUE MANAGEMENT
  // ============================================================

  function enqueue(type, data) {
    queue.push({ type, data });
    if (!processing) drainQueue();
  }

  function hasPendingCombatAction() {
    return queue.some((queuedItem) => queuedItem?.type === "combatAction");
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
      const item = queue.shift();
      try {
        await dispatchQueueItem(item);
      } catch (err) {
        console.error("[AnimManager] Queue item error:", err);
      }
    }

    processing = false;

    if (typeof onQueueEmpty === "function" && currentPhase === "combat") {
      currentPhase = null;
      onQueueEmpty();
    }
  }

  async function dispatchQueueItem(item) {
    switch (item.type) {
      case "combatAction":
        await processCombatAction(item.data);
        await wait(TIMING.BETWEEN_ACTIONS);
        break;

      case "gameStateUpdate":
        processGameStateUpdate(item.data);
        break;

      case "turnUpdate":
        processTurnUpdate(item.data);
        break;

      case "championRemoved":
        await processChampionRemoved(item.data);
        break;

      case "combatLog":
        appendToLog(item.data);
        break;

      case "actionDialog":
        await showDialog(item.data);
        break;

      case "combatPhaseComplete":
        currentPhase = "combat";
        break;

      case "gameOver":
        await handleGameOver(item.data);
        break;

      default:
        console.warn("[AnimManager] Unknown queue type:", item.type);
    }
  }

  // ============================================================
  //  COMBAT ACTION PROCESSING
  // ============================================================

  function createEventDispatcher() {
    const handlers = {
      damageEvents: { handler: animateDamage, parallel: true },
      healEvents: { handler: animateHeal },
      lifestealEvents: { handler: animateLifesteal },
      shieldEvents: { handler: animateShield },
      buffEvents: { handler: animateBuff, single: true },
      resourceEvents: { handler: animateResourceChange },
      redirectionEvents: { handler: animateTauntRedirection },
    };

    const keys = Object.keys(handlers);

    async function runEvent(event, handler) {
      if (event.preDialogs?.length) {
        await runDialogs(event.preDialogs);
      }
      await Promise.resolve(handler(event));
      if (event.postDialogs?.length) {
        await runDialogs(event.postDialogs);
      }
    }

    // Plays a whole wave at once: dialogs stay sequential (they share the
    // single dialog bubble), while the animations themselves overlap and
    // share one canvas via canvasBatch instead of mounting one each.
    async function runBatch(batch, handler) {
      for (const event of batch) {
        if (event.preDialogs?.length) await runDialogs(event.preDialogs);
      }

      const canvasBatch = new EffectCanvasBatch();
      await Promise.all(
        batch.map((event) => Promise.resolve(handler(event, canvasBatch))),
      );

      for (const event of batch) {
        if (event.postDialogs?.length) await runDialogs(event.postDialogs);
      }
    }

    // 💥 Splits a chunk of events into "waves" that can be animated at the
    // same time. Any skill that hits more than one champion is AoE by
    // definition, so its hits are played simultaneously. A repeated target
    // means a new hit on someone already struck in this wave, so it opens
    // the next wave and keeps multi-hit skills readable.
    function buildSimultaneousBatches(events) {
      const batches = [];
      let current = [];
      let seenTargets = new Set();

      for (const event of events) {
        if (!event) continue;

        const targetId = event.targetId ?? null;

        if (current.length && (targetId === null || seenTargets.has(targetId))) {
          batches.push(current);
          current = [];
          seenTargets = new Set();
        }

        current.push(event);
        if (targetId !== null) seenTargets.add(targetId);
      }

      if (current.length) batches.push(current);

      return batches;
    }

    async function runGroup(key, events) {
      if (!Array.isArray(events) || events.length === 0) return;

      const config = handlers[key];

      if (!config) {
        console.warn("Unknown event:", key);
        return;
      }

      const { handler, single, parallel } = config;

      if (parallel) {
        // AoE: every hit of the same wave is played simultaneously.
        for (const batch of buildSimultaneousBatches(events)) {
          await runBatch(batch, handler);
        }
        return;
      }

      if (single) {
        const event = events[0];
        if (event) {
          await runEvent(event, handler);
        }
        return;
      }

      let prevResourcePhase = null;

      for (const event of events) {
        if (!event) continue;

        if (key === "resourceEvents") {
          const phase = event.phase ?? "default";

          if (prevResourcePhase !== null && phase !== prevResourcePhase) {
            await wait(TIMING.RESOURCE_PHASE_GAP);
          }

          prevResourcePhase = phase;
        }

        await runEvent(event, handler);
      }
    }

    // 🔢 Flattens all event groups into a single list ordered by the real
    // chronological sequence (event.seq) in which they were registered on
    // the server, instead of the fixed category order above. Consecutive
    // events of the same key are kept together in "chunks" so each chunk
    // can still be run through the existing runGroup (preserving per-group
    // behaviors like buffEvents' "single" mode and resourceEvents' phase gap).
    function buildOrderedChunks(envelope) {
      const flat = [];

      for (const key of keys) {
        const events = envelope[key];
        if (!Array.isArray(events)) continue;

        for (const event of events) {
          if (!event) continue;
          flat.push({ key, event });
        }
      }

      // Stable sort by seq; events without a seq (legacy/fallback) fall back
      // to their original push order.
      flat.forEach((item, idx) => {
        item._idx = idx;
      });
      flat.sort((a, b) => {
        const seqA = Number.isFinite(a.event.seq) ? a.event.seq : Infinity;
        const seqB = Number.isFinite(b.event.seq) ? b.event.seq : Infinity;
        if (seqA !== seqB) return seqA - seqB;
        return a._idx - b._idx;
      });

      const chunks = [];
      for (const item of flat) {
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk && lastChunk.key === item.key) {
          lastChunk.events.push(item.event);
        } else {
          chunks.push({ key: item.key, events: [item.event] });
        }
      }

      return chunks;
    }

    async function runOrdered(envelope) {
      const chunks = buildOrderedChunks(envelope);
      for (const chunk of chunks) {
        await runGroup(chunk.key, chunk.events);
      }
    }

    return {
      keys,
      runGroup,
      runOrdered,
    };
  }

  async function processCombatAction(envelope) {
    const dispatcher = createEventDispatcher();
    const { action, log, state } = envelope;
    const isClaim = envelope?.action?.skillKey === CLAIM_ACTION_KEY;

    // Mounted up front so the caster's ring is already lit under the "used a
    // skill" dialog — a purely deferred skill (a hook registration, a stance)
    // has no events to animate but still reads as an action taken.
    const clearAffectGlows = applySkillAffectGlows(envelope);

    try {
      if (action && typeof handleActionDialog === "function") {
        currentPhase = "combat";
        await handleActionDialog(action);
      }

      if (envelope.scorePayload) {
        if (isClaim) {
          await scoreboard.animateClaim(envelope.scorePayload);
        } else {
          scoreboard.update(envelope.scorePayload);
        }
      }

      // GLOBAL dialogs (ALWAYS runs)
      if (envelope.globalDialogs?.length) {
        await runDialogs(envelope.globalDialogs);
      }
      const hasAnyEvent =
        dispatcher.keys.some((key) => envelope[key]?.length) ||
        Boolean(envelope.scorePayload);

      if (!hasAnyEvent) {
        if (state) applyStateSnapshots(state);
        if (log) appendToLog(log);
        return;
      }

      // event loop — plays events in the real chronological order (seq)
      // instead of a fixed category order.
      await dispatcher.runOrdered(envelope);

      if (state) applyStateSnapshots(state);
      if (log) appendToLog(log);
    } finally {
      clearAffectGlows();
    }
  }

  // ============================================================
  //  ANIMATION HELPERS
  // ============================================================

  // Resolves a champion's display name from its id, or a neutral fallback.
  function championName(championId) {
    const champion = deps.activeChampions.get(championId);
    return champion ? formatChampionName(champion) : "Target";
  }

  // Resolves the DOM + model handles for a target and scrolls it into view.
  // Returns null when the champion element is absent so callers can bail early.
  function resolveTargetVisual(targetId) {
    const championEl = getChampionElement(targetId);
    if (!championEl) return null;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const portrait = portraitWrapper?.querySelector(".portrait");
    if (portrait) scrollIfNeeded(portrait, { threshold: 0.85 });

    const champion = deps.activeChampions.get(targetId);
    return {
      championEl,
      portraitWrapper,
      champion,
      name: champion ? formatChampionName(champion) : "Target",
    };
  }

  // ============================================================
  //  DAMAGE ANIMATION
  //
  //  CSS mapping:
  //    .damage           → on .champion (shake + red tint via ::after)
  //    .damage-float     → inside .portrait-wrapper (floating number)
  //    .damage-tier-{N}  → font size tier for the float
  // ============================================================

  async function animateDamage(effect, canvasBatch) {
    const {
      targetId,
      userId,
      sourceId,
      rawAmount,
      absorbedByShield,
      remainingShield,
      isCritical,
      isDot,
      finishing,
      finishingType,
      skillKey,
      element,
      contact,
      hitVfx,
    } = effect;

    const target = resolveTargetVisual(targetId);
    if (!target) return;
    const { championEl, portraitWrapper, champion, name: targetName } = target;

    const casterId = userId || sourceId || null;
    const userEl = casterId ? getChampionElement(casterId) : null;
    const userChampion = casterId ? deps.activeChampions.get(casterId) : null;
    const skill = userChampion?.skills?.find((s) => s?.key === skillKey);

    // Skill animation (if registered) — per DamageEvent
    if (skillKey) {
      await animateSkill(skillKey, {
        targetEl: championEl,
        userEl,
        skill,
        hit: { element, contact, hitVfx },
        canvasBatch,
      });
    }

    // ========================
    // INTERRUPTIONS
    // ========================

    if (effect.evaded !== undefined) {
      await animateEvasion(effect);
      if (effect.evaded) return;
    }

    const resolvedFinishingType =
      finishingType || (finishing ? "regular" : null);
    const hasFinishing = !!resolvedFinishingType;
    const usesObliterateStyle = resolvedFinishingType === "obliterate";

    const hpDamage = Math.max(0, Number(rawAmount) || 0);
    const absorbedFromEvent = Math.max(0, Number(absorbedByShield) || 0);
    const hasShieldAbsorption = absorbedFromEvent > 0;
    const hasHpDamage = hpDamage > 0;

    if (effect.immune) return await animateImmune(effect);
    if (effect.shieldBlocked) return await animateShieldBlock(effect);
    if (!hasFinishing && !hasHpDamage && !hasShieldAbsorption) return;

    // ========================
    // PRE-DAMAGE (DOT)
    // ========================

    if (isDot) {
      await showDialog(`${targetName} took damage.`);
    }

    // ========================
    // IMMEDIATE VISUAL FEEDBACK
    // ========================

    const shouldPlayDamageFeedback = hasFinishing || hasHpDamage;

    if (shouldPlayDamageFeedback) {
      championEl.classList.add("damage");
      audioManager.play("damage");
    }

    if (portraitWrapper) {
      if (usesObliterateStyle || hasFinishing) {
        const extraClass = usesObliterateStyle ? "obliterate" : "finishing";
        createFloatElement(portraitWrapper, "999", "damage-float", extraClass);
      } else {
        if (hasHpDamage) {
          const damageTierClass = `damage-tier-${getDamageTier(Math.max(1, hpDamage))}`;
          createFloatElement(
            portraitWrapper,
            `-${hpDamage}`,
            "damage-float",
            damageTierClass,
          );
        }

        if (hasShieldAbsorption) {
          createFloatElement(
            portraitWrapper,
            `🛡️ -${absorbedFromEvent}`,
            "shield-float",
            "shield-absorbed-float",
          );
        }
      }
    }

    // ========================
    // MAIN EXECUTION
    // ========================

    if (hasFinishing) {
      updateVisualHP(targetId, -champion.currentHp, 0);

      await playFinishingEffect(championEl, {
        variant: resolvedFinishingType || "regular",
      });

      championEl.dataset.finishing = "true";
      championEl.dataset.finishingType = resolvedFinishingType || "regular";

      return; // already awaited everything
    }

    const hpText = championEl.querySelector(".hp")?.textContent || "";
    const visualState = parseVisualHpState(hpText);
    const fallbackAbsorbed =
      visualState && Number.isFinite(remainingShield)
        ? Math.max(0, visualState.shield - Math.max(0, Number(remainingShield)))
        : 0;
    const absorbed = absorbedFromEvent || fallbackAbsorbed;
    const shouldSyncShieldFromDamage = absorbed > 0;

    updateVisualHP(targetId, -hpDamage, null, {
      shieldDelta: shouldSyncShieldFromDamage ? -absorbed : 0,
      shieldOverride:
        shouldSyncShieldFromDamage && Number.isFinite(remainingShield)
          ? Math.max(0, Number(remainingShield))
          : null,
    });

    // ========================
    // CRITICAL (internal dialog)
    // ========================

    if (isCritical) {
      await showDialog(
        `A CRITICAL HIT! ${targetName} took a devastating blow!`,
      );
    }

    // ========================
    // ACTUAL ANIMATION WAIT
    // ========================

    if (shouldPlayDamageFeedback) {
      await waitForAnimation(championEl, 600);

      // ⚠️ this delay is important for visual pacing
      await wait(450);

      championEl.classList.remove("damage");
      lastDamageAnimationTime = Date.now(); // 🛡️ Track damage animation completion
      return;
    }

    // If there's only shield absorption without HP damage, maintain visual pacing
    await wait(300);
    lastDamageAnimationTime = Date.now(); // 🛡️ Track even shield-only animations
  }

  /** * Unique helper to clean up the animation event boilerplate
   */
  function waitForAnimation(el, timeout) {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.target === el) cleanup();
      };
      const timer = setTimeout(cleanup, timeout);
      function cleanup() {
        el.removeEventListener("animationend", handler);
        clearTimeout(timer);
        resolve();
      }
      el.addEventListener("animationend", handler);
    });
  }

  // ============================================================
  //  HEAL ANIMATION
  //
  //  CSS mapping:
  //    .heal        → on .champion (green glow via ::after)
  //    .heal-float  → inside .portrait-wrapper (floating number)
  // ============================================================

  async function animateHeal(effect) {
    const { targetId, amount } = effect;
    const target = resolveTargetVisual(targetId);
    if (!target) return;
    const { championEl, portraitWrapper, name } = target;

    await showDialog(`${name} restored health.`);
    audioManager.play("heal");

    championEl.classList.add("heal");
    createFloatElement(portraitWrapper, `+${amount}`, "heal-float");
    updateVisualHP(targetId, amount);

    await waitForAnimation(championEl, 600);
    championEl.classList.remove("heal");
  }

  async function animateLifesteal(effect) {
    const { targetId, amount, fromTargetId } = effect;
    const target = resolveTargetVisual(targetId);
    if (!target) return;
    const { championEl, portraitWrapper, name } = target;

    const drainedEl = fromTargetId ? getChampionElement(fromTargetId) : null;

    await showDialog(`${name} drained life from the target.`);

    // Reuses the healing SFX with its own visual signature for lifesteal.
    audioManager.play("heal");

    if (drainedEl) {
      drainedEl.classList.add("lifesteal-drained");
    }

    championEl.classList.add("lifesteal");

    await playLifestealTransferVFX({
      fromEl: drainedEl,
      toEl: championEl,
      duration: 780,
    });

    if (portraitWrapper) {
      createFloatElement(
        portraitWrapper,
        `+${amount}`,
        "heal-float",
        "lifesteal-float",
      );
    }

    updateVisualHP(targetId, amount);

    await waitForAnimation(championEl, 760);

    championEl.classList.remove("lifesteal");

    if (drainedEl) {
      drainedEl.classList.remove("lifesteal-drained");
    }
  }

  // ============================================================
  //  EVASION ANIMATION
  //
  //  CSS mapping:
  //    .evasion → on .champion (dodge weave + flash via ::after)
  // ============================================================

  async function animateEvasion(effect) {
    const { targetId, evaded } = effect;
    const target = resolveTargetVisual(targetId);
    if (!target) return;
    const { championEl, name } = target;

    await showDialog(`${name} tried to evade the attack...`);

    if (evaded) {
      championEl.classList.add("evasion");

      await waitForAnimation(championEl, 600);

      championEl.classList.remove("evasion");
      await showDialog(`${name} SUCCESSFULLY evaded the attack!!`);
    } else {
      await showDialog(`...but failed to evade.`);
    }
  }

  //  ============================================================
  //  SHIELD ANIMATION
  //
  //  CSS mapping:
  //    .shield-float → inside .portrait-wrapper (floating number)
  //    .has-shield   → applied on .champion via updateUI (bubble effect)
  // ============================================================

  async function animateShield(effect) {
    const { targetId, amount } = effect;
    const target = resolveTargetVisual(targetId);
    if (!target) return;

    await showDialog(`${target.name} gained a shield.`);

    createFloatElement(target.portraitWrapper, `🛡️ ${amount}`, "shield-float");

    updateVisualHP(targetId, 0, null, {
      shieldDelta: Number(amount) || 0,
    });

    // Shield bubble visual (.has-shield) is applied when state syncs via updateUI
    await wait(600);
  }

  // ============================================================
  //  RESOURCE REGEN ANIMATION
  // ============================================================

  function animateResourceChange(effect, direction = null) {
    const { targetId, amount } = effect || {};
    const normalizedAmount = Math.abs(Number(amount) || 0);
    if (!targetId || normalizedAmount <= 0) return;

    const target = resolveTargetVisual(targetId);
    if (!target) return;

    const eventDirection =
      direction ?? (effect?.type === "resourceSpend" ? -1 : 1);
    const sign = eventDirection >= 0 ? "+" : "-";
    const floatClass =
      eventDirection >= 0
        ? "resource-float-momentum-gain"
        : "resource-float-momentum-spend";

    createFloatElement(
      target.portraitWrapper,
      `${sign}${normalizedAmount.toFixed(0)} Momentum`,
      "resource-float",
      floatClass,
    );

    updateVisualResource(
      targetId,
      eventDirection >= 0 ? normalizedAmount : -normalizedAmount,
    );
  }

  // ============================================================
  //  IMMUNE ANIMATION
  // ============================================================

  async function animateImmune(effect) {
    if (effect.immuneQuiet) return;

    const { targetId, immuneMessage } = effect;
    const message = immuneMessage || `${championName(targetId)} is <b>Immune!</b>`;
    await showDialog(message);
  }

  // ============================================================
  //  SHIELD BLOCK ANIMATION
  // ============================================================

  async function animateShieldBlock(effect) {
    await showDialog(
      `${championName(effect.targetId)}'s shield blocked the attack!`,
    );
  }

  // ============================================================
  //  BUFF ANIMATION
  // ============================================================

  async function animateBuff(effect) {
    const { sourceId, targetId, sourceName, targetName } = effect || {};
    const target = resolveTargetVisual(targetId);
    if (!target) return;
    const { championEl, portraitWrapper, champion: targetChampion } = target;

    const resolvedTargetName = targetChampion
      ? formatChampionName(targetChampion)
      : targetName || "Target";

    const sourceChampion = deps.activeChampions.get(sourceId);
    const resolvedSourceName = sourceChampion
      ? formatChampionName(sourceChampion)
      : sourceName || null;

    // Self-buff when there is no source, or source === target.
    let text;
    if (!sourceId || sourceId === targetId) {
      text = `${resolvedTargetName} buffed themselves.`;
    } else if (resolvedSourceName) {
      text = `${resolvedTargetName} was buffed by ${resolvedSourceName}.`;
    } else {
      text = `${resolvedTargetName} was buffed.`;
    }

    await showDialog(text);

    championEl.classList.add("buff");
    createFloatElement(portraitWrapper, "+BUFF", "buff-float");

    await waitForAnimation(championEl, 600);
    championEl.classList.remove("buff");
  }

  // ============================================================
  //  TAUNT ANIMATION
  // ============================================================

  async function animateTauntRedirection(effect) {
    const { attackerId } = effect;
    const championEl = getChampionElement(attackerId);
    const portraitWrapper = championEl?.querySelector(".portrait-wrapper");

    await showDialog(
      `${championName(attackerId)} was <b>taunted</b> and had their target redirected!`,
    );

    championEl.classList.add("taunt");
    createFloatElement(portraitWrapper, "TAUNTED", "taunt-float");

    await waitForAnimation(championEl, 400);
    championEl.classList.remove("taunt");
  }

  // ============================================================
  //  GAME OVER HANDLING
  // ============================================================

  async function handleGameOver(effect) {
    const winnerTeam = Number(effect?.winnerTeam);
    const hasWinner = winnerTeam === 1 || winnerTeam === 2;
    const isDraw = !hasWinner;

    window.gameEnded = true;

    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverContent =
      gameOverOverlay?.querySelector(".game-over-content");
    const gameOverMessage = document.getElementById("gameOverMessage");
    const returnToLoginBtn = document.getElementById("returnToLoginBtn");

    if (!gameOverOverlay || !gameOverContent || !gameOverMessage) return;

    const playerTeam = Number(window.playerTeam);
    const isWinner = hasWinner && playerTeam === winnerTeam;

    let message = "Defeat";
    let outcomeClass = "lose";
    let overlayClass = "lose-background";

    if (isDraw) {
      message = "Draw";
      outcomeClass = "draw";
      overlayClass = "draw-background";
    } else if (isWinner) {
      message = "Victory!!";
      outcomeClass = "win";
      overlayClass = "win-background";
    }

    gameOverMessage.textContent = message;

    gameOverContent.classList.remove("hidden", "win", "lose", "draw");
    gameOverContent.classList.add(outcomeClass);

    gameOverOverlay.classList.remove(
      "hidden",
      "win-background",
      "lose-background",
      "draw-background",
    );
    gameOverOverlay.classList.add("active", overlayClass);

    // Play appropriate sound
    audioManager.play(isDraw ? "defeat" : isWinner ? "victory" : "defeat");

    // Timer for return to login
    const timerOverlay = document.getElementById("timerOverlay");
    const countdownEl = document.getElementById("returnToLoginCountdown");

    if (timerOverlay && countdownEl && returnToLoginBtn) {
      // Show game over screen for 10 seconds, then show countdown timer
      await wait(10000);

      gameOverOverlay.classList.remove("active");
      gameOverOverlay.classList.add("hidden");

      timerOverlay.classList.remove("hidden");
      timerOverlay.classList.add("active");

      matchStats.show();

      let timeLeft = 120;
      countdownEl.textContent = `Returning to login in ${timeLeft}s...`;

      const interval = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = `Returning to login in ${timeLeft}s...`;
        if (timeLeft <= 0) {
          clearInterval(interval);
          window.location.reload();
        }
      }, 1000);

      returnToLoginBtn.onclick = () => {
        clearInterval(interval);
        window.location.reload();
      };
    }
  }

  // ============================================================
  //  VISUAL HP UPDATE (incremental, before final state sync)
  //
  //  Reads current displayed HP from the DOM, applies a delta,
  //  and updates the HP text + fill bar. This ensures the bar
  //  never jumps to the final value before the animation plays.
  //
  //  The authoritative state is applied AFTER all effects via
  //  applyStateSnapshots() which calls champion.updateUI().
  // ============================================================

  function updateVisualHP(
    championId,
    delta,
    currentVisualHP = null,
    options = {},
  ) {
    delta = Number(delta) || 0;
    const shieldDelta = Number(options?.shieldDelta) || 0;
    const shieldOverride = Number.isFinite(options?.shieldOverride)
      ? Math.max(0, Number(options.shieldOverride))
      : null;

    const el = getChampionElement(championId);
    if (!el) return;

    const hpSpan = el.querySelector(".hp");
    const fill = el.querySelector(".hp-fill");
    if (!hpSpan || !fill) return;

    // Parse current displayed HP (format: "current/max" or "current/max 🛡️ (N)")
    const hpText = hpSpan.textContent;
    const visualState = parseVisualHpState(hpText);
    if (!visualState) return;

    currentVisualHP =
      currentVisualHP !== null ? currentVisualHP : visualState.currentHP;

    const maxHP = visualState.maxHP;
    const currentShield = visualState.shield;

    // Apply delta and clamp
    currentVisualHP = Math.max(0, Math.min(maxHP, currentVisualHP + delta));
    const nextShield =
      shieldOverride !== null
        ? shieldOverride
        : Math.max(0, currentShield + shieldDelta);

    const shieldSuffix = nextShield > 0 ? ` 🛡️ (${nextShield})` : "";

    hpSpan.textContent = `${currentVisualHP}/${maxHP}${shieldSuffix}`;

    // Update fill bar width and color
    const percent = (currentVisualHP / maxHP) * 100;
    fill.style.width = `${percent}%`;

    if (percent <= 19) {
      fill.style.background = "#ff2a2a";
    } else if (percent <= 49) {
      fill.style.background = "#ffcc00";
    } else {
      fill.style.background = "#00ff66";
    }
  }

  function updateVisualResource(championId, deltaUnits) {
    const el = getChampionElement(championId);
    if (!el) return;

    const fill = el.querySelector(".momentum-fill");
    if (!fill) return;

    // Momentum is a fixed 0-100 bar; the dataset holds the trusted UI value.
    const MAX_UNITS = 100;
    const currentUnits = Math.max(
      0,
      Math.min(MAX_UNITS, Number(el.dataset.momentumUnits || 0) + deltaUnits),
    );

    el.dataset.momentumUnits = currentUnits;
    fill.style.width = `${(currentUnits / MAX_UNITS) * 100}%`;
  }

  // ============================================================
  //  FLOAT ELEMENT CREATION
  //
  //  Creates a floating number element (damage/heal/shield)
  //  inside a container (typically .portrait-wrapper).
  //  Auto-removes after the CSS animation completes.
  // ============================================================

  function createFloatElement(container, text, ...cssClasses) {
    const float = document.createElement("span");
    float.classList.add(...cssClasses.filter(Boolean));
    float.textContent = text;
    container.appendChild(float);
    setTimeout(() => {
      if (float.parentNode) float.remove();
    }, TIMING.FLOAT_LIFETIME + 200);
    return float;
  }

  // ============================================================
  //  COMBAT DIALOG (JRPG-style speech bubbles)
  //
  //  Shows a short, non-verbose text in the combat dialog overlay.
  //  Each call waits for the dialog to display and fade out
  //  before returning, ensuring sequential dialog display.
  //
  //  CSS classes used:
  //    .combat-dialog.hidden   → not visible
  //    .combat-dialog.active   → visible (triggers dialogIn)
  //    .combat-dialog.leaving  → fading out (triggers dialogOut)
  // ============================================================

  async function handleActionDialog(action) {
    if (!action) return;

    const { userId, userName, skillName, targetId, targetName } = action;

    const userChampion = deps.activeChampions.get(userId);

    const resolvedUserName = userChampion
      ? formatChampionName(userChampion)
      : userName || "Someone";

    const resolvedSkillName = skillName
      ? `<b>${typeof skillName === "object" ? skillName.name : skillName}</b>`
      : "<b>a skill</b>";

    // Fully trust the server-provided target.
    const hasValidTarget = targetId && targetId !== userId && targetName;

    const dialogText = hasValidTarget
      ? `${resolvedUserName} used ${resolvedSkillName} on ${targetName}.`
      : `${resolvedUserName} used ${resolvedSkillName}.`;

    await showDialog(dialogText);
  }

  function createDialogController() {
    let skipRequested = false;
    let releaseCurrentWait = null;

    function resolveCurrentWaitNow() {
      if (typeof releaseCurrentWait === "function") {
        releaseCurrentWait();
      }
    }

    return {
      async waitWithOptionalSkip(ms) {
        if (skipRequested) {
          await wait(20);
          return;
        }

        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            releaseCurrentWait = null;
            resolve();
          }, ms);

          releaseCurrentWait = () => {
            clearTimeout(timer);
            releaseCurrentWait = null;
            resolve();
          };
        });
      },
      requestSkip() {
        skipRequested = true;
        resolveCurrentWaitNow();
      },
      dispose() {
        releaseCurrentWait = null;
      },
    };
  }

  /**
   * Unified dialog display. If duration is provided, dialog auto-closes after duration ms. If omitted, dialog is blocking and always waits for user or skip (never auto-advances).
   * @param {string} text
   * @param {number} [duration] - Optional duration in ms. If omitted, dialog is blocking (user/skip only).
   */
  // The dialog bubble is a single shared element, so concurrent animations
  // (AoE damage played simultaneously) must never write to it at the same
  // time. Every call is chained onto the previous one, keeping dialogs
  // sequential even when their animations run in parallel.
  let dialogQueueTail = Promise.resolve();

  function showDialog(text, duration) {
    const run = dialogQueueTail.then(() => presentDialog(text, duration));
    dialogQueueTail = run.catch(() => {});
    return run;
  }

  async function presentDialog(text, duration) {
    const dialog = deps.combatDialog;
    const dialogText = deps.combatDialogText;
    if (!dialog || !dialogText) return;

    const dialogController = createDialogController();
    activeDialogController = dialogController;
    dialogText.innerHTML = text;
    dialog.classList.remove("hidden", "leaving");
    dialog.classList.add("active");

    if (duration) {
      // Non-blocking: auto-close after duration, but allow skip at any time.
      await wait(20); // allow the DOM update to paint first
      wait(duration).then(() => dialogController.requestSkip());
      await dialogController.waitWithOptionalSkip(duration + 100);
      dialog.classList.add("leaving");
      await wait(TIMING.DIALOG_LEAVE);
    } else {
      // Blocking: wait for skip/user.
      await dialogController.waitWithOptionalSkip(TIMING.DIALOG_DISPLAY);
      dialog.classList.add("leaving");
      await dialogController.waitWithOptionalSkip(TIMING.DIALOG_LEAVE);
    }

    dialog.classList.remove("active", "leaving");
    dialog.classList.add("hidden");
    if (activeDialogController === dialogController) {
      activeDialogController = null;
    }
    dialogController.dispose();
  }

  /**
   * Runs a sequence of dialogs, respecting blocking/duration semantics.
   * Each dialog object: { message, duration? }
   * If duration is omitted, dialog is blocking (user/skip).
   */
  async function runDialogs(dialogs) {
    for (const d of dialogs) {
      if (d.duration) {
        await showDialog(d.message, d.duration);
      } else if (d.blocking === false) {
        await showDialog(d.message, 1000); // default non-blocking duration
      } else {
        await showDialog(d.message);
      }
    }
  }

  // ============================================================
  //  STATE SYNCHRONIZATION
  //
  //  Applies authoritative champion state from server snapshots.
  //  Called AFTER all effects are animated for an action,
  //  ensuring the visual state matches the server truth.
  // ============================================================

  function applyStateSnapshots(snapshots) {
    if (!Array.isArray(snapshots)) return;

    for (const snap of snapshots) {
      if (!snap?.id) continue;

      const champion = deps.activeChampions.get(snap.id);
      if (!champion) continue;

      // 🛡️ Check if shields changed to add buffer for animation
      const hadShieldsBefore = Array.isArray(champion.runtime?.shields) && champion.runtime.shields.length > 0;
      const hasShieldsAfter = Array.isArray(snap.runtime?.shields) && snap.runtime.shields.length > 0;
      const shieldsChanged = hadShieldsBefore !== hasShieldsAfter;

      syncChampionFromSnapshot(champion, snap);

      // 🛡️ Calculate delay for shield changes
      let delayMs = 0;
      if (shieldsChanged) {
        const timeSinceLastDamage = Date.now() - lastDamageAnimationTime;
        // If shield changed within 1 second of damage animation, add extra buffer
        if (timeSinceLastDamage < 1000) {
          delayMs = 500; // Longer buffer when shield consumed after damage
        } else {
          delayMs = 250; // Normal buffer for other shield changes
        }
      }

      // Shield changes need a buffer so the bubble doesn't pop before the
      // damage animation reads; other updates run immediately.
      const runAfterDelay = (fn) =>
        delayMs > 0 ? setTimeout(fn, delayMs) : fn();

      runAfterDelay(() => {
        champion.updateUI({ freeCostSkills: editMode?.freeCostSkills === true });
        StatusIndicator.updateChampionIndicators(champion);
      });

      const shouldSyncVfxNow =
        currentPhase !== "combat" && !hasPendingCombatAction();

      if (shouldSyncVfxNow) runAfterDelay(() => syncChampionVFX(champion));
    }
  }

  function syncChampionFromSnapshot(champion, snap) {
    let slotChanged = false;

    if (snap.portrait != undefined) {
      champion.portrait = snap.portrait;
    }

    if (snap.matchStats !== undefined) {
      champion.matchStats = champion.buildMatchStats
        ? champion.buildMatchStats(snap.matchStats)
        : { ...snap.matchStats };
    }

    // 🔥 HP is only applied if there was NO damage animation
    if (snap.HP !== undefined) {
      champion.HP = snap.HP;
      champion.currentHp = snap.HP; // In order to keep currentHp in sync with the real HP from the snapshot
    }

    for (const key of SNAPSHOT_PASSTHROUGH_KEYS) {
      if (snap[key] !== undefined) champion[key] = snap[key];
    }

    // Runtime shields
    if (snap.runtime) {
      champion.runtime = {
        ...snap.runtime,
      };
    }

    // Runtime hook data (data-only, safe for client UI)
    if (Array.isArray(snap.runtimeHookEffectData)) {
      champion.runtime ??= {};
      champion.runtime.hookEffectData = snap.runtimeHookEffectData;
    }

    if (snap.actionBlockedByHardCC !== undefined) {
      champion.actionBlockedByHardCC = snap.actionBlockedByHardCC === true;
    }

    // StatusEffects
    if (Array.isArray(snap.statusEffects)) {
      champion.statusEffects = new Map(snap.statusEffects);
    }

    // TauntEffects (for taunt indicator)
    if (Array.isArray(snap.tauntEffects)) {
      champion.tauntEffects = snap.tauntEffects;
    }

    // Alive
    if (snap.HP !== undefined) {
      champion.alive = snap.HP > 0;
    }

    if (snap.entityType !== undefined) {
      champion.entityType = snap.entityType;
      if (champion.el) champion.el.dataset.entityType = snap.entityType;
    }

    // Reported back so the caller can re-sort the row: a slot can move after
    // creation, and DOM order otherwise stays frozen at arrival order.
    if (snap.combatSlot !== undefined && snap.combatSlot !== champion.combatSlot) {
      champion.combatSlot = snap.combatSlot;
      slotChanged = true;
    }

    if (snap.name !== undefined && snap.name !== champion.name) {
      champion.name = snap.name;
      if (champion.el) {
        const nameEl = champion.el.querySelector(".champion-name");
        if (nameEl) nameEl.textContent = snap.name;
      }
    }

    return slotChanged;
  }

  // ============================================================
  //  GAME STATE UPDATE (full state sync)
  //
  //  Called after team selection, champion additions, and
  //  at end of each turn. Creates new champions if needed
  //  and syncs all champion data to server truth.
  // ============================================================

  function processGameStateUpdate(gameState) {
    if (!gameState) return;

    const { champions, currentTurn } = gameState;

    if (currentTurn !== undefined) {
      deps.setCurrentTurn(currentTurn);
    }

    if (!Array.isArray(champions)) return;

    // Track which champion IDs are in the new gameState
    const newChampionIds = new Set(
      champions.map((c) => c?.id).filter((id) => id),
    );

    let slotsChanged = false;

    // 1. SYNC EXISTING CHAMPIONS AND CREATE NEW ONES
    // With the new swap system (inactiveChampions), Lana and Tutu have different IDs,
    // so a "championKey mismatch" never occurs for the same ID.
    // The else-if block below is reserved for FUTURE TRANSFORMATIONS (e.g., Lana → Lana_Evolved)
    // where the SAME object changes type but keeps the same ID.
    for (const champData of champions) {
      if (!champData?.id) continue;

      let champion = deps.activeChampions.get(champData.id);

      if (!champion) {
        // NEW CHAMPION: create from server snapshot
        champion = deps.createNewChampion(champData);
      } else if (
        champData.championKey &&
        champion.championKey &&
        champion.championKey !== champData.championKey
      ) {
        // TRANSFORMATION (future): same ID, type changed — destroy and recreate
        // Ex: Lana (id=X) → Lana_Evolved (id=X)
        champion.destroy();
        deps.activeChampions.delete(champData.id);
        champion = deps.createNewChampion(champData);
        deps.onChampionReplaced?.();
      }

      if (syncChampionFromSnapshot(champion, champData)) slotsChanged = true;

      champion.updateUI({
        freeCostSkills: editMode?.freeCostSkills === true,
      });

      syncChampionVFX(champion);
    }

    // 2. REMOVE CHAMPIONS THAT WERE SWAPPED OUT
    // With the new system (swap via inactiveChampions), swapped-out champions disappear from the gameState.
    // Their old objects in the DOM must be destroyed.
    // Ex: Lana swaps to inactiveChampions → her ID is no longer in the gameState → remove from the frontend.
    for (const [champId, champion] of deps.activeChampions) {
      if (!newChampionIds.has(champId)) {
        champion.destroy();
        deps.activeChampions.delete(champId);
      }
    }

    if (slotsChanged) deps.onChampionReplaced?.();

    // Keep status indicator loop on only when needed
    deps.syncStatusIndicatorRotation();

    deps.onGameStateProcessed?.();
  }

  // ============================================================
  //  TURN UPDATE
  // ============================================================

  function processTurnUpdate(turn) {
    deps.applyTurnUpdate(turn);
  }

  // ============================================================
  //  CHAMPION REMOVED (death animation)
  //
  //  CSS class: .champion.dying → collapse animation (950ms)
  //  Waits for animation, then removes the DOM element.
  // ============================================================

  async function processChampionRemoved(payload) {
    const { championId } = payload;

    const champion = deps.activeChampions.get(championId);
    if (!champion) return;

    const el = champion.el;
    if (!el) return;

    if (champion.runtime?.deathClaimTriggered) {
      // special vfx + dialog for Jeff_The_Death claim/special execution
      const name = formatChampionName(champion);

      await playDeathClaimEffect(el);

      await showDialog(`The Death claims ${name}!`);

      await wait(TIMING.DEATH_CLAIM_EFFECT);

      // normal death
    } else if (!el.dataset.finishing) {
      // Apply dying class — triggers CSS collapse animation
      el.classList.add("dying");

      // Wait for the death animation to play
      await wait(TIMING.DEATH_ANIM);
    }

    // Remove from DOM
    el.remove();
    champion.el = null;

    deps.activeChampions.delete(championId);
  }

  // ============================================================
  //  COMBAT LOG APPENDING
  //
  //  Manages the text-based combat log panel, including
  //  turn headers for visual separation between turns.
  // ============================================================

  function appendToLog(text) {
    if (!text) return;

    const log = document.getElementById("combat-log");
    if (!log) return;

    const currentTurn = deps.getCurrentTurn();

    // Insert turn header if this is the first log entry for this turn
    if (lastLoggedTurn !== currentTurn) {
      lastLoggedTurn = currentTurn;
      const turnHeader = document.createElement("h2");
      turnHeader.classList.add("turn-header");
      turnHeader.textContent = `Turn ${currentTurn}`;
      log.appendChild(turnHeader);
    }

    // Visual separator between log entries
    if (log.children.length > 1) {
      log.appendChild(document.createElement("br"));
    }

    const line = document.createElement("p");
    line.innerHTML = text.replace(/\n/g, "<br>");
    log.appendChild(line);

    // Auto-scroll to latest entry
    log.scrollTop = log.scrollHeight;
  }

  // ============================================================
  //  RESET
  // ============================================================

  function reset() {
    queue.length = 0;
    processing = false;
    lastLoggedTurn = null;
    matchStats.reset();
  }

  // ============================================================
  //  TURN TRANSITION (banner animation + turn display)
  // ============================================================

  let turnTransitionTimer = null;
  let turnTransitionSequence = 0;
  let isFirstTurnUpdate = true;
  let lastDisplayedTurn = null;

  function showTurnTransition(turn) {
    const overlay = document.getElementById("turnTransitionOverlay");
    const number = document.getElementById("turnTransitionNumber");

    if (!overlay || !number) return;

    const sequence = ++turnTransitionSequence;

    clearTimeout(turnTransitionTimer);

    const turnLabel = turn === 20 ? "LAST TURN" : `TURN ${turn}`;

    // Ensure the overlay starts showing the new turn.
    number.textContent = turnLabel;

    // Reset the text animation.
    number.classList.remove("is-changing");

    // Force the browser to acknowledge the initial state.
    void number.offsetWidth;

    // Overlay entrance.
    overlay.classList.add("is-visible");

    // Keep the banner visible for a moment.
    turnTransitionTimer = setTimeout(() => {
      if (sequence !== turnTransitionSequence) return;

      // Fade/blur the current turn.
      number.classList.add("is-changing");

      setTimeout(() => {
        if (sequence !== turnTransitionSequence) return;

        number.textContent = turnLabel;

        // Force reflow to restart the entrance.
        void number.offsetWidth;

        number.classList.remove("is-changing");

        // After showing the new turn, close the overlay.
        turnTransitionTimer = setTimeout(() => {
          if (sequence !== turnTransitionSequence) return;

          overlay.classList.remove("is-visible");
        }, 700);
      }, 230);
    }, 700);
  }

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

  // ============================================================
  //  PUBLIC API
  // ============================================================

  return {
    updateTurnDisplay,
    handleCombatAction(envelope) {
      enqueue("combatAction", envelope);
    },
    handleCombatLog(text) {
      enqueue("combatLog", text);
    },
    handleActionFailed(message) {
      enqueue("actionDialog", message);
    },
    handleGameStateUpdate(gameState) {
      enqueue("gameStateUpdate", gameState);
    },
    handleTurnUpdate(turn) {
      enqueue("turnUpdate", turn);
    },
    handleChampionRemoved(payload) {
      enqueue("championRemoved", payload);
    },
    handleGameOver(data) {
      enqueue("gameOver", data);
    },
    handleCombatPhaseComplete() {
      enqueue("combatPhaseComplete", null);
    },
    appendToLog,
    reset,
  };
}
