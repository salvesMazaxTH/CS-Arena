import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "backstab",
  name: "Backstab",

  description() {
    return `Whenever Isarelis acts before the chosen target, her attacks deal +${this.damageBonusRatio * 100}% bonus damage and convert ${this.piercingRatio * 100}% of their damage into Piercing Damage.`;
  },

  damageBonusRatio: 0.2,
  piercingRatio: 0.6,

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({
    attacker,
    owner,
    defender,
    skill,
    context,
    damage,
    baseDamage,
  }) {
    if (attacker !== owner) return;

    // Only activates for Isarelis's damaging abilities.
    if (!skill || !["eviscerate", "coup_de_grace"].includes(skill.key)) {
      return;
    }

    // Check execution order.
    const execIdx = context?.executionIndex;
    const turnMap = context?.turnExecutionMap;

    let actedBeforeTarget = false;

    if (execIdx !== undefined && typeof turnMap?.get === "function") {
      const targetIdx = turnMap.get(defender?.id);

      actedBeforeTarget = targetIdx === undefined || execIdx < targetIdx;
    } else {
      // Fallback for scenarios without an explicit execution map.
      actedBeforeTarget =
        Number(attacker?.Speed || 0) > Number(defender?.Speed || 0);
    }

    if (!actedBeforeTarget) return;

    // Apply bonus damage and piercing.
    const hookBaseDamage = Number(baseDamage ?? damage ?? 0);

    const finalBaseDamage = hookBaseDamage * (1 + this.damageBonusRatio);

    context?.registerDialog?.({
      message: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        attacker,
      )} strikes before the target can react! (+Piercing)`,
      sourceId: attacker.id,
      targetId: defender.id,
    });

    return {
      baseDamage: finalBaseDamage,
      preMitigationDamage: finalBaseDamage,
      mode: "piercing",
      piercingPercentage: this.piercingRatio * 100,
    };
  },
};
