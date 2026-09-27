import { formatChampionName } from "../../ui/formatters.js";
import { SpawnProtection } from "./spawnProtection.js";
import { emitCombatEvent } from "./combatEvents.js";

// Engine state, never a status: a cleanse must not be able to pull someone out.
export class Nothingness {
  static label = "Nothingness";

  static isVanished(champion) {
    return champion?.runtime?.nothingness != null;
  }

  // Mutations may arrive without a context, and the hooks still need the whole match.
  static eventContext(combat, context) {
    return (
      context ?? {
        currentTurn: combat.currentTurn,
        allChampions: combat.activeChampions,
        players: combat.match?.players,
        get matchChampions() {
          return [
            ...combat.activeChampions.values(),
            ...combat.inactiveChampions.values(),
            ...combat.deadChampions.values(),
          ];
        },
      }
    );
  }

  // The one who left is off the field, so it is told alongside everyone still on it.
  static emit(combat, eventName, champion, context) {
    emitCombatEvent(
      eventName,
      { champion, context: this.eventContext(combat, context) },
      [...combat.activeChampions.values(), champion],
      { players: combat.match?.players },
    );
  }

  static send(
    combat,
    championId,
    {
      turns = 1,
      returnState = null,
      ruptureSourceId = null,
      context = null,
    } = {},
  ) {
    const champion = combat.activeChampions.get(championId);
    if (!champion) return null;

    combat.swapOut(championId);
    delete champion.runtime.currentContext;

    champion.runtime.nothingness = {
      returnAtTurn: combat.currentTurn + Math.max(1, turns),
      returnState,
      ruptureSourceId,
    };

    this.emit(combat, "onChampionVanished", champion, context);

    return {
      champion,
      log: {
        en: `${formatChampionName(champion)} slips into the Nothingness.`,
        pt: `${formatChampionName(champion)} escorrega para o Nada.`,
      },
    };
  }

  static recall(combat, championId, { context = null, maxPerTeam = 3 } = {}) {
    const champion = combat.inactiveChampions.get(championId);
    if (!this.isVanished(champion)) return null;
    if (
      !combat.canSpawnOnTeam(champion.team, maxPerTeam, {
        entityType: champion.entityType,
      })
    ) {
      return null;
    }

    if (combat.getChampionAtSlot(champion.team, champion.combatSlot)) {
      champion.combatSlot = combat.getNextAvailableSlot(champion.team);
    }

    const { returnState } = champion.runtime.nothingness;
    combat.restoreInactive(championId);
    delete champion.runtime.nothingness;

    if (Number.isFinite(returnState?.hp)) {
      champion.HP = Math.min(
        champion.maxHP,
        Math.max(1, Math.round(returnState.hp)),
      );
    } else if (Number.isFinite(returnState?.hpRatio)) {
      champion.HP = Math.max(
        1,
        Math.round(champion.maxHP * returnState.hpRatio),
      );
    }

    if (returnState?.purify) {
      champion
        .getStatusEffects({ type: "debuff" })
        .forEach((statusEffect) =>
          champion.removeStatusEffect(statusEffect.key),
        );
    }

    SpawnProtection.grant(champion);
    champion.runtime.arrivalVfx = "nothingness_return";
    if (context) champion.runtime.currentContext = context;

    this.emit(combat, "onChampionReturned", champion, context);

    return {
      champion,
      log: {
        en: `${formatChampionName(champion)} steps back out of the Nothingness.`,
        pt: `${formatChampionName(champion)} retorna do Nada.`,
      },
    };
  }

  /** Everyone whose stay is over; one that finds no free slot simply stays overdue. */
  static processDueReturns(combat, context = null, { maxPerTeam = 3 } = {}) {
    const vanished = [...combat.inactiveChampions.values()].filter((champion) =>
      this.isVanished(champion),
    );

    const isDue = (champion) =>
      champion.runtime.nothingness.returnAtTurn <= combat.currentTurn;

    const due = vanished.filter((champion) => {
      if (!isDue(champion)) return false;

      const groupId = champion.runtime.nothingness.returnState?.groupId;
      if (!groupId) return true;

      const group = vanished.filter(
        (member) => member.runtime.nothingness.returnState?.groupId === groupId,
      );

      return (
        group.every(isDue) &&
        combat.canSpawnOnTeam(champion.team, maxPerTeam, {
          entityType: champion.entityType,
          requiredSlots: group.length,
        })
      );
    });

    return due
      .map((champion) =>
        this.recall(combat, champion.id, { context, maxPerTeam }),
      )
      .filter(Boolean);
  }

  /** A vanish dies with whoever cast it, throwing its victim back at once. */
  static processRuptures(combat, context = null) {
    const ruptured = [...combat.inactiveChampions.values()].filter(
      (champion) => {
        if (!this.isVanished(champion)) return false;

        const sourceId = champion.runtime.nothingness.ruptureSourceId;
        if (!sourceId) return false;

        const source = combat.getChampion(sourceId);
        return !source || !source.alive;
      },
    );

    return ruptured
      .map((champion) => {
        const recalled = this.recall(combat, champion.id, { context });
        if (recalled) return recalled;

        champion.runtime.nothingness.returnAtTurn = combat.currentTurn;
        return null;
      })
      .filter(Boolean);
  }
}
