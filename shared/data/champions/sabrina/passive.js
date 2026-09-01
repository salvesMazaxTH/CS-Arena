import { formatChampionName } from "../../../ui/formatters.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";

export default {
  key: "thermal_convergence",
  name: "Thermal Convergence",

  iceBonusRatio: 0.4,

  hits: [
    {
      id: "crystallization",
      label: "Thermal Convergence (Passive)",
      type: "magical",
      element: "ice",
      contact: false,
      damageMode: "standard",
    },
  ],

  description() {
    return `Whenever Sabrina deals Water damage to a Chilled enemy, the water crystallizes into Ice, dealing an additional Ice hit equal to ${this.iceBonusRatio * 100}% of the Water damage dealt.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ attacker, owner, defender, damage, element, context }) {
    if (attacker !== owner) return;
    if (!damage || damage <= 0) return;
    if (element !== "water") return;
    if (!defender?.alive) return;
    if (!defender.hasStatusEffect("chilled")) return;

    const iceDamage = damage * this.iceBonusRatio;

    context?.registerDialog?.({
      message: `<b>[Passive — ${this.name}]</b> The water around ${formatChampionName(defender)} crystallizes into Ice!`,
      sourceId: owner.id,
      targetId: defender.id,
    });

    SkillHits.run(this, "crystallization", {
      user: owner,
      target: defender,
      baseDamage: iceDamage,
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
    });
  },
};
