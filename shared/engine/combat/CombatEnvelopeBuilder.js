import { formatChampionName } from "../../ui/formatters.js";

/**
 * Turns resolved combat contexts into the "combatAction" payloads the client
 * animates. Pure: it only reads combat state and builds objects — emitting them
 * over the socket stays the server's responsibility.
 */
export class CombatEnvelopeBuilder {
  constructor(combat) {
    this.combat = combat;
  }

  /**
   * Builds the action envelope from a resolved context, or null when there is
   * nothing worth emitting (no action, no visual changes, no score).
   */
  buildActionEnvelope({
    user,
    skill,
    context,
    scorePayload = null,
    claimPoints = null,
    log = null,
  }) {
    const mainEnvelope = this.buildMainEnvelope({ user, skill, context });
    if (!mainEnvelope) return null;

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

    if (!(mainEnvelope.action || hasVisualChanges || !!scorePayload)) {
      return null;
    }

    return {
      ...mainEnvelope,
      ...(log ? { log } : null),
      scorePayload,
      claimPoints,
    };
  }

  buildMainEnvelope({ user, skill, context }) {
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

    // All affected targets (damage, heal, buff, shield) the user themselves
    // actually caused, deduped, excluding the user. A bystander passive (e.g.
    // Seymour's radiance firing off someone else's Claim) writes into this
    // same shared context but its events carry a different sourceId — they
    // are not this action's own doing and must not be read as its targets.
    const uniqueTargetIds = [
      ...new Set(
        [...damageEvents, ...healEvents, ...shieldEvents, ...buffEvents]
          .filter((e) => e.sourceId === userId)
          .map((e) => e.targetId)
          .filter((id) => id && id !== userId),
      ),
    ];

    // Split into enemies and allies.
    const userTeam = user?.team;
    const enemies = uniqueTargetIds.filter((id) => {
      const champ = this.combat.getChampion(id);
      return champ && userTeam !== undefined && champ.team !== userTeam;
    });
    const allies = uniqueTargetIds.filter((id) => {
      const champ = this.combat.getChampion(id);
      return champ && userTeam !== undefined && champ.team === userTeam;
    });

    // Show enemies if any were hit; otherwise show allies.
    const realTargetIds = enemies.length > 0 ? enemies : allies;
    const { targetId, targetName } = this.buildTargetInfo(realTargetIds);

    const skillKey = skill?.key;

    return {
      action: user
        ? {
            userId,
            userName,
            skillKey,
            skillName: skill?.name,
            targetId,
            targetName,
          }
        : null,
      // Every damageEvent carries skillKey so the client can animate per hit.
      damageEvents: damageEvents.map((event) => ({ ...event, skillKey })),
      healEvents,
      lifestealEvents,
      shieldEvents,
      buffEvents,
      resourceEvents,
      redirectionEvents,
      globalDialogs,
      state: context._intermediateSnapshot,
    };
  }

  /** Target id/name shown alongside an action, from the real target ids. */
  buildTargetInfo(realTargetIds) {
    let targetName = null;

    if (realTargetIds.length === 1) {
      const champ = this.combat.getChampion(realTargetIds[0]);
      targetName = champ ? formatChampionName(champ) : null;
    } else if (realTargetIds.length > 1) {
      const names = realTargetIds.map((id) => {
        const champ = this.combat.getChampion(id);
        return champ ? formatChampionName(champ) : "Unknown";
      });

      const last = names.pop();
      targetName = `${names.join(", ")} and ${last}`;
    }

    return { targetId: realTargetIds[0] ?? null, targetName };
  }

  /** Recursively gathers every log/logMessage string out of a results tree. */
  collectLogs(value, logs = [], visited = new Set()) {
    if (value == null) return logs;

    if (typeof value === "string") {
      if (value.trim()) logs.push(value);
      return logs;
    }

    if (Array.isArray(value)) {
      for (const entry of value) this.collectLogs(entry, logs, visited);
      return logs;
    }

    if (typeof value !== "object" || visited.has(value)) return logs;
    visited.add(value);

    if (typeof value.log === "string" && value.log.trim()) logs.push(value.log);
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
      if (Array.isArray(value[key])) this.collectLogs(value[key], logs, visited);
    }

    return logs;
  }
}
