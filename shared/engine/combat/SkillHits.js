import { DamageEvent } from "./DamageEvent.js";

// A skill whose hits diverge declares them as data in `hits: [...]` and fires
// them by id, so the branching stays in the skill while each hit's element,
// contact, damage mode and visual motif stay declarative.
export class SkillHits {
  static spec(skill, hitId) {
    const spec = skill?.hits?.find((h) => h.id === hitId);

    if (!spec) {
      throw new Error(
        `[SkillHits] skill "${skill?.key}" declares no hit "${hitId}"`,
      );
    }

    return spec;
  }

  static params(skill, hitId, { user, target, context, baseDamage } = {}) {
    const spec = this.spec(skill, hitId);
    // Naming a field is what overrides the skill, so `null` opts the hit out.
    const inherit = (field) => (field in spec ? spec[field] : skill[field]);

    return {
      baseDamage: baseDamage ?? (user.Attack * inherit("bf")) / 100,
      attacker: user,
      defender: target,
      skill,
      hitId,
      type: inherit("type"),
      element: inherit("element"),
      contact: inherit("contact"),
      mode: inherit("damageMode"),
      hitVfx: inherit("hitVfx"),
      piercingPercentage: spec.piercingPercentage,
      hitLabel: spec.label ?? null,
      suppressLog: spec.suppressLog ?? skill.suppressLog ?? false,
      context,
      allChampions: context?.allChampions,
    };
  }

  // For a hit fired straight from resolve(). Hits that must land after the
  // current one push `params()` onto context.extraDamageQueue instead.
  static run(skill, hitId, opts) {
    return new DamageEvent(this.params(skill, hitId, opts)).execute();
  }
}
