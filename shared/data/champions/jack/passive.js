import { formatChampionName } from "../../../ui/formatters.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";

export const SOLVED_RUNTIME_FLAG = "jackSolved";

export default {
  key: "show_your_work",
  name: "Show Your Work",

  floorPercent: 90,
  refinementPercent: 8,
  maxSolvedPercentOfAttack: 90,
  paralysisDamage: 40,

  // Its own absolute hit neither reads nor writes the working, and neither does
  // the ultimate that spends it.
  solvesWorking: false,

  hits: [
    {
      id: "closing_argument",
      label: "Show Your Work (Passive)",
      type: "magical",
      contact: false,
      damageMode: "absolute",
    },
  ],

  description() {
    return `Jack keeps the working, and the best figure he has ever got out of an enemy stays written beside their name — refined ${this.refinementPercent}% upward every time he hits them again, up to ${this.maxSolvedPercentOfAttack}% of his Attack. His damage against them can never come out below ${this.floorPercent}% of that figure, however they have shored themselves up since.

    And the moment an enemy champion is Paralyzed, he has already solved for it: ${this.paralysisDamage} Absolute Damage, delivered with an apology he does not mean.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectApplied: undefined,
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, skill }) {
    if (attacker !== owner || defender === owner) return;
    if (skill?.isUltimate || skill?.solvesWorking === false) return;

    const solved = defender.runtime[SOLVED_RUNTIME_FLAG] ?? 0;
    const raised = Math.max(
      Math.round(Number(damage)),
      Math.round((solved * this.floorPercent) / 100),
    );

    defender.runtime[SOLVED_RUNTIME_FLAG] = Math.min(
      Math.round((Math.max(solved, raised) * (100 + this.refinementPercent)) / 100),
      Math.round((owner.Attack * this.maxSolvedPercentOfAttack) / 100),
    );

    if (raised <= Number(damage)) return;
    return { damage: raised };
  },

  onStatusEffectApplied({ target, statusEffect, context, owner }) {
    if (statusEffect.key !== "paralyzed") return;
    if (target.team === owner.team || !owner.alive) return;

    context.registerDialog?.({
      message: `${formatChampionName(owner)} already knew where ${formatChampionName(target)} would seize up, and puts ${this.paralysisDamage} Absolute Damage exactly there.`,
      sourceId: owner.id,
      targetId: target.id,
    });

    SkillHits.run(this, "closing_argument", {
      user: owner,
      target,
      baseDamage: this.paralysisDamage,
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
    });
  },
};
