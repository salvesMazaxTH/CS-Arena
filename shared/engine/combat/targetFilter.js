import { StatusEffectsRegistry } from "../../data/statusEffects/effectsRegistry.js";

/** Who may fill a targetSpec role. The picker offers and the server accepts by
 *  this same rule, so a target the UI shows can never be refused on resolution. */
export class TargetFilter {
  /** The side a spec aims at, dropping any prefix: "select:ally" and "all:ally"
   *  both aim at "ally". */
  static sideOf(spec) {
    const type = typeof spec === "string" ? spec : spec.type;
    return type.split(":").pop();
  }

  static matchesSide(spec, user, candidate) {
    switch (this.sideOf(spec)) {
      case "self":
        return candidate.id === user.id;
      case "ally":
        return candidate.team === user.team;
      case "enemy":
        return candidate.team !== user.team;
      default:
        return true;
    }
  }

  static matchesFilters(spec, user, candidate) {
    if (spec.excludesSelf && candidate.id === user.id) return false;
    if (spec.excludesKeys?.includes(candidate.championKey)) return false;

    const entityType = candidate.entityType ?? "champion";
    if (spec.entityType && entityType !== spec.entityType) return false;

    const flags = candidate.runtime ?? {};
    if (spec.requiresRuntimeFlag && !flags[spec.requiresRuntimeFlag]) return false;
    if (spec.excludesRuntimeFlag && flags[spec.excludesRuntimeFlag]) return false;

    if (
      user.team !== candidate.team &&
      this.hiddenFromAttacker(user, candidate)
    ) {
      return false;
    }

    return true;
  }

  /** A stealth-style status effect on `candidate` can hide it from `attacker`,
   *  so it is offered and accepted only for attackers it does not hide from. */
  static hiddenFromAttacker(attacker, candidate) {
    if (!attacker || !(candidate?.statusEffects instanceof Map)) return false;

    for (const effect of candidate.statusEffects.values()) {
      const def = StatusEffectsRegistry[effect?.key];
      if (def?.hidesFromAttacker?.(attacker, candidate)) return true;
    }

    return false;
  }

  static accepts(spec, user, candidate) {
    return (
      !!candidate?.alive &&
      this.matchesSide(spec, user, candidate) &&
      this.matchesFilters(spec, user, candidate)
    );
  }

  static candidates(spec, user, champions) {
    return champions.filter((candidate) => this.accepts(spec, user, candidate));
  }

  /** The spec governing a filled role key such as "ally" or "enemy2". */
  static specForRole(targetSpec, role) {
    const side = role.replace(/\d+$/, "");

    return targetSpec
      .map((spec) => (typeof spec === "string" ? { type: spec } : spec))
      .find((spec) => this.sideOf(spec) === side);
  }
}
