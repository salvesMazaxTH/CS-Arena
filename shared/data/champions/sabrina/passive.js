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
    return {
      en: `Whenever Sabrina deals <b>Water damage</b> to a <b>Chilled</b> enemy, the water crystallizes into <b>Ice</b>, dealing an additional Ice hit equal to <b>${this.iceBonusRatio * 100}%</b> of the Water damage dealt.`,
      pt: `Sempre que Sabrina causa <b>dano de Água</b> em um inimigo <b>Gelado</b>, a água se cristaliza em <b>Gelo</b>, causando um golpe adicional de Gelo igual a <b>${this.iceBonusRatio * 100}%</b> do dano de Água causado.`,
    };
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
      message: {
        en: `<b>[Passive — ${this.name}]</b> The water around ${formatChampionName(defender)} crystallizes into Ice!`,
        pt: `<b>[Passivo — ${this.name}]</b> A água ao redor de ${formatChampionName(defender)} se cristaliza em Gelo!`,
      },
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
