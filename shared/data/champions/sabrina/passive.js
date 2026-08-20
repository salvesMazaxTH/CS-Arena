import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "thermal_convergence",
  name: "Thermal Convergence",

  iceBonusRatio: 0.4,

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

    new DamageEvent({
      baseDamage: iceDamage,
      attacker: owner,
      defender,
      skill: {
        key: "thermal_convergence_passive",
        name: "Thermal Convergence (Passive)",
        contact: false,
      },
      element: "ice",
      type: "magical",
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      allChampions: context.allChampions,
    }).execute();
  },
};
