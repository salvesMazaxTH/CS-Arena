import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { SOLVED_RUNTIME_FLAG } from "./passive.js";

// Whether the enemy's own action, still queued behind Jack's, is a damaging one
// that will land on him once it resolves.
function isComingForHim(enemy, jack, context) {
  const action = context.pendingActions?.find((a) => a.userId === enemy.id);
  if (!action) return false;

  const skill = enemy.skills.find((s) => s.key === action.skillKey);
  if (!skill?.damageMode) return false;

  const spec = (skill.targetSpec ?? []).map((s) =>
    typeof s === "string" ? s : s.type,
  );
  if (spec.includes("all") || spec.includes("all:enemy")) return true;

  const taunt = enemy.tauntEffects?.find(
    (e) => e.expiresAtTurn > context.currentTurn,
  );
  if (taunt) return taunt.taunterId === jack.id;

  return Object.values(action.targetIds ?? {}).includes(jack.id);
}

const jackSkills = [
  totalBlock,

  {
    key: "predictable",
    name: "Predictable",

    bf: 60,
    stunDuration: 1,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    priority: 3,

    description() {
      return `Jack worked out who was coming for him before the turn even started, and is already standing where the answer said to stand. Deals magical damage, but only if the chosen target was about to attack him this turn — the jolt lands first and Stuns them, so the attack never happens. If he read it wrong, nothing happens at all.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      if (!isComingForHim(enemy, user, context)) {
        context.registerDialog({
          message: `${formatChampionName(user)} steps into where the answer said ${formatChampionName(enemy)} would be, and finds nobody there.`,
          sourceId: user.id,
          targetId: enemy.id,
        });

        return [];
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "stunned")) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          sourceId: user.id,
        });

        context.registerDialog({
          message: `${formatChampionName(enemy)} never gets to throw it — ${formatChampionName(user)} was already there.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return result;
    },
  },

  {
    key: "extrapolate",
    name: "Extrapolate",

    bf: 80,
    missingHpScalingPercent: 60,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    priority: 0,

    description() {
      return `Jack has been plotting the chosen target since the first hit, and the curve only ever points one way. Deals magical damage, plus up to an extra ${this.missingHpScalingPercent}% of his Attack scaled by how much HP they have already lost.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const missingHpRatio = 1 - enemy.HP / enemy.maxHP;

      return new DamageEvent({
        baseDamage:
          (user.Attack * this.bf) / 100 +
          (user.Attack * this.missingHpScalingPercent * missingHpRatio) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "qed",
    name: "Q.E.D.",

    bf: 110,
    solvedPercentAsBonus: 75,
    paralysisDuration: 1,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Jack underlines the last line of the working twice and turns the page around so the chosen target can read it. Deals magical damage, spending the figure he has solved on them to add ${this.solvedPercentAsBonus}% of it as bonus damage, and leaves them Paralyzed for ${this.paralysisDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const solved = enemy.runtime[SOLVED_RUNTIME_FLAG] ?? 0;
      delete enemy.runtime[SOLVED_RUNTIME_FLAG];

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: (solved * this.solvedPercentAsBonus) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralysisDuration, context, {
          sourceId: user.id,
        });
      }

      context.registerDialog({
        message: `${formatChampionName(user)} closes the proof on ${formatChampionName(enemy)}, and looks faintly bored about it.`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return result;
    },
  },
];

export default jackSkills;
