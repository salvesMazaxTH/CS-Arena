import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

export const BLIND_MISS_CHANCE = 0.75;

// Whether a Blinded champion's action misses. "Aimed" means the target came from
// this turn's player input — `TurnResolver.resolveSkillTargets` stamps
// `context.targetsFromPlayerInput`. Area, self, taunt-forced and rule-picked
// targets are never blinded; a skill can still opt out narratively with
// `cannotBeBlinded: true`.
export function getBlindMiss(user, skill, targets, context) {
  if (!user?.hasStatusEffect?.("blind")) return null;
  if (!skill || skill.cannotBeBlinded) return null;
  if (!context?.targetsFromPlayerInput) return null;

  const aimed = (Array.isArray(targets) ? targets : [targets]).filter(
    (t) => t && t.id && t.id !== user.id,
  );
  if (aimed.length !== 1) return null;

  if (Math.random() >= BLIND_MISS_CHANCE) return null;

  return {
    message: `${formatChampionName(user)} is Blind — ${skill.name || "the strike"} goes wide and finds nothing.`,
  };
}

const blind = {
  key: "blind",
  name: "Blind",
  type: "debuff",
  subtypes: ["softCC"],
  missChance: BLIND_MISS_CHANCE,

  description:
    "An aimed single-target ability has a 75% chance to miss. Area abilities are unaffected.",

  createInstance({ owner, duration, context, metadata }) {
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
      },
    });
  },
};

export default blind;
