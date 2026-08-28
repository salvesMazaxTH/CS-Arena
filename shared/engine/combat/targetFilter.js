/** Who may fill a targetSpec role. The picker offers and the server accepts by
 *  this same rule, so a target the UI shows can never be refused on resolution. */
export class TargetFilter {
  /** The side a spec targets: "ally", "enemy", "any" or "self". */
  static sideOf(spec) {
    const type = typeof spec === "string" ? spec : spec.type;
    return type.split(":").pop();
  }

  static accepts(spec, user, candidate) {
    if (!candidate?.alive) return false;

    const side = this.sideOf(spec);
    if (side === "ally" && candidate.team !== user.team) return false;
    if (side === "enemy" && candidate.team === user.team) return false;
    if (side === "self" && candidate.id !== user.id) return false;

    if (spec.excludesSelf && candidate.id === user.id) return false;
    if (spec.excludesKeys?.includes(candidate.championKey)) return false;

    if (
      spec.entityType &&
      (candidate.entityType ?? "champion") !== spec.entityType
    )
      return false;

    if (spec.runtimeFlag && !candidate.runtime?.[spec.runtimeFlag]) return false;
    if (spec.excludesRuntimeFlag && candidate.runtime?.[spec.excludesRuntimeFlag])
      return false;

    return true;
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
