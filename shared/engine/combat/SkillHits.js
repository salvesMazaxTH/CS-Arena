import { DamageEvent } from "./DamageEvent.js";

// A skill whose hits diverge declares them as data in `hits: [...]` and fires
// them by id from resolve(), so the branching stays in the skill while each
// hit's element, contact, damage mode and visual motif stay declarative.
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

  static run(skill, hitId, { user, target, context, baseDamage }) {
    const spec = this.spec(skill, hitId);

    return new DamageEvent({
      baseDamage: baseDamage ?? (user.Attack * (spec.bf ?? skill.bf)) / 100,
      attacker: user,
      defender: target,
      skill,
      type: spec.type ?? skill.type,
      element: spec.element ?? skill.element,
      contact: spec.contact ?? skill.contact,
      mode: spec.damageMode ?? skill.damageMode,
      piercingPercentage: spec.piercingPercentage,
      hitVfx: spec.hitVfx ?? skill.hitVfx,
      hitLabel: spec.label ?? null,
      context,
      allChampions: context?.allChampions,
    }).execute();
  }
}
