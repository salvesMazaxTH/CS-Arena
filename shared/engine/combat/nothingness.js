import { formatChampionName } from "../../ui/formatters.js";
import { SpawnProtection } from "./spawnProtection.js";

// Engine state, never a status: a cleanse must not be able to pull someone out.
export class Nothingness {
  static label = "Nothingness";

  static isVanished(champion) {
    return champion?.runtime?.nothingness != null;
  }

  static send(
    combat,
    championId,
    { turns = 1, returnState = null, ruptureSourceId = null } = {},
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

    return {
      champion,
      log: `${formatChampionName(champion)} slips into the Nothingness.`,
    };
  }

  static recall(combat, championId, { context = null, maxPerTeam = 3 } = {}) {
    const champion = combat.inactiveChampions.get(championId);
    if (!this.isVanished(champion)) return null;
    if (!combat.canSpawnOnTeam(champion.team, maxPerTeam)) return null;

    if (combat.getChampionAtSlot(champion.team, champion.combatSlot)) {
      champion.combatSlot = combat.getNextAvailableSlot(
        champion.team,
        maxPerTeam,
      );
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
    if (context) champion.runtime.currentContext = context;

    return {
      champion,
      log: `${formatChampionName(champion)} steps back out of the Nothingness.`,
    };
  }

  /** Everyone whose stay is over; one that finds no free slot simply stays overdue. */
  static processDueReturns(combat, context = null) {
    const due = [...combat.inactiveChampions.values()].filter(
      (champion) =>
        this.isVanished(champion) &&
        champion.runtime.nothingness.returnAtTurn <= combat.currentTurn,
    );

    return due
      .map((champion) => this.recall(combat, champion.id, { context }))
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
