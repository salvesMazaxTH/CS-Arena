import { SpawnProtection } from "./spawnProtection.js";

const debugMode = false; // Set to true to enable detailed logging of combat events

// The hook source whose handler is executing right now, so anything it creates
// (a stat modifier, a damage modifier) can record where it came from.
let runningHook = null;

/** { kind: "passive" | "status" | "effect" | "emblem", source, owner } or null. */
export function getRunningHook() {
  return runningHook;
}

function runHook(kind, source, owner, fn) {
  const previous = runningHook;
  runningHook = { kind, source, owner };
  try {
    return fn();
  } finally {
    runningHook = previous;
  }
}

export function emitCombatEvent(eventName, payload, champions, options = {}) {
  const results = [];

  const players = options.players ?? payload?.context?.players ?? [];
  const canRun = options?.canRun;



  if (debugMode) {
    console.group(`📡 EVENT: ${eventName}`);
    /*  console.log(`[EVENT EMIT] ${eventName}`, {
      source: payload?.source?.name,
      target: payload?.target?.name,
    }); */
  }

  if (!champions) {
    if (debugMode) {
      // console.log(`[EVENT EMIT] ⚠️ No champions provided`);
    }
    return results;
  }

  const champArray = Array.isArray(champions)
    ? champions
    : Array.from(champions.values());

  for (const champ of champArray) {
    // A fallen champion still answers the event about the death itself.
    if (champ.alive === false && eventName !== "onChampionDeath") continue;
    if (SpawnProtection.blocksReaction(eventName, champ)) continue;

    const hookSources = [];

    if (champ.passive) {
      hookSources.push({ kind: "passive", source: champ.passive });
    }

    if (champ.statusEffects && champ.statusEffects.size > 0) {
      for (const effectInstance of champ.statusEffects.values()) {
        hookSources.push({ kind: "status", source: effectInstance });
      }
    }

    if (champ.runtime?.hookEffects?.length) {
      for (const effect of champ.runtime.hookEffects) {
        hookSources.push({ kind: "effect", source: effect });
      }
    }

    const ctx = payload?.context;
    const rebindsActionSource = ctx != null && "actionSourceId" in ctx;
    const previousActionSourceId = rebindsActionSource
      ? ctx.actionSourceId
      : null;

    if (rebindsActionSource) ctx.actionSourceId = champ.id;

    try {
      for (const { kind, source } of hookSources) {
        const hook = source[eventName];
        if (typeof hook !== "function") continue;

        const scope = source.hookScope?.[eventName];

        if (scope && payload[scope] !== champ) continue;
        if (typeof canRun === "function" && !canRun(eventName, champ, source)) {
          continue;
        }

        try {
          const res = runHook(kind, source, champ, () =>
            hook.call(source, {
              ...payload,
              owner: champ,
              emitter: emitCombatEvent,
            }),
          );

          if (res) {
            results.push(res);
          }
        } catch (err) {
          console.error(
            `[HOOK ERROR] ${champ.name} → ${source.key || "passive"}.${eventName}`,
            err,
          );
        }
      }
    } finally {
      if (rebindsActionSource) ctx.actionSourceId = previousActionSourceId;
    }
  }

  for (const player of players) {
    const emblemSources = Array.isArray(player?.emblems) ? player.emblems : [];

    for (const source of emblemSources) {
      const hook = source[eventName];
      if (typeof hook !== "function") continue;

      if (typeof canRun === "function" && !canRun(eventName, null, source)) {
        continue;
      }

      try {
        const res = runHook("emblem", source, player, () =>
          hook.call(source, {
            ...payload,
            owner: player,
            emitter: emitCombatEvent,
          }),
        );

        if (res) {
          results.push(res);
        }
      } catch (err) {
        console.error(
          `[EMBLEM HOOK ERROR] Player ${player?.team ?? "?"} → ${
            source.key || "emblem"
          }.${eventName}`,
          err,
        );
      }
    }
  }

  if (debugMode) {
    // console.log(`[EVENT EMIT] 📦 Aggregated results:`, results);
    console.groupEnd();
  }

  return results;
}
