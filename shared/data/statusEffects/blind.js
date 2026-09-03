import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { CLAIM_ACTION_KEY } from "../../engine/combat/claim.js";

export const BLIND_MISS_CHANCE = 0.75;

// Blind only touches a champion actively aiming one shot at one target. Anything
// that hits a whole line, or that a champion does to itself, is untouched — and
// a telegraphed, non-aimed single-target effect opts out with `cannotBeBlinded`.
const AOE_SPEC_TOKENS = [
  "all",
  "all:enemy",
  "all:ally",
  "all-enemies",
  "all-allies",
];

function isAimedSingleTarget(skill) {
  if (!skill || skill.cannotBeBlinded) return false;
  if (skill.key === CLAIM_ACTION_KEY) return false;

  const spec = Array.isArray(skill.targetSpec)
    ? skill.targetSpec.map((s) => (typeof s === "string" ? s : s?.type))
    : [];

  if (!spec.length) return false;
  if (spec.some((s) => AOE_SPEC_TOKENS.includes(s))) return false;
  if (spec.every((s) => s === "self")) return false;

  return true;
}

const blind = {
  key: "blind",
  name: "Blind",
  type: "debuff",
  subtypes: ["softCC"],
  missChance: BLIND_MISS_CHANCE,

  description:
    "An aimed single-target ability has a 75% chance to miss. Area abilities are unaffected.",

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource, skill }) {
    if (!isAimedSingleTarget(skill)) return;
    if (Math.random() >= BLIND_MISS_CHANCE) return;

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} is Blind — ${skill.name || "the strike"} goes wide and finds nothing.`,
    };
  },

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
        hookScope: this.hookScope,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default blind;
