const debugMode = false; // Set to true to enable detailed logging of combat events

export function emitCombatEvent(eventName, payload, champions, options = {}) {
  const results = [];

  const players = options.players ?? payload?.context?.players ?? [];

  console.log(`[emitCombatEvent] Event: ${eventName}, Players:`, players);

  console.log(`[emitCombatEvent] ${eventName}`, {
    champions: Array.isArray(champions)
      ? champions.length
      : (champions?.size ?? 0),

    players: Array.isArray(players)
      ? players.map((p) => ({
          id: p?.id,
          team: p?.team,
          emblems: p?.emblems?.map((e) => e?.key) ?? [],
        }))
      : players,
  });

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
    const hookSources = [];

    // 🔹 Passiva real
    if (champ.passive) {
      hookSources.push(champ.passive);
    }

    // 🔹 StatusEffects (Map)
    if (champ.statusEffects && champ.statusEffects.size > 0) {
      for (const effectInstance of champ.statusEffects.values()) {
        hookSources.push(effectInstance);
      }
    }

    // 🔹 Hook effects temporários
    if (champ.runtime?.hookEffects?.length) {
      hookSources.push(...champ.runtime.hookEffects);
    }

    for (const source of hookSources) {
      const hook = source[eventName];
      if (typeof hook !== "function") continue;

      if (debugMode) {
        // console.log(`➡️ Triggering ${champ.name} (${source.key || "passive"})`);
      }

      const scope = source.hookScope?.[eventName];
      const canRun = options?.canRun;

      if (scope && payload[scope] !== champ) continue;
      if (typeof canRun === "function" && !canRun(eventName, champ, source)) {
        continue;
      }

      try {
        // console.log(`[HOOK CALL] ${champ.name} → ${source.key}.${eventName}`);
        const res = hook.call(source, {
          ...payload,
          owner: champ,
          emitter: emitCombatEvent,
        });

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
  }

  for (const player of players) {
    const emblemSources = Array.isArray(player?.emblems) ? player.emblems : [];

    for (const source of emblemSources) {
      const hook = source[eventName];
      if (typeof hook !== "function") continue;

      console.log(
        `[EMBLEM HOOK] ${eventName} → ${source.key} → Player ${player.team}`,
      );

      try {
        const res = hook.call(source, {
          ...payload,
          owner: player,
          emitter: emitCombatEvent,
        });

        console.log(`[EMBLEM HOOK RESULT] ${eventName} → ${source.key}:`, res);

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
