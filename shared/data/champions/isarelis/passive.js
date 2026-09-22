import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "backstab",
  name: "Backstab",

  description() {
    return {
      en: `Isarelis never announces herself — the blade is already in before the target knows she moved. Whenever she acts before the chosen target, her attacks deal <b>+${this.damageBonusRatio * 100}%</b> bonus damage and convert <b>${this.piercingRatio * 100}%</b> of their damage into <b>Piercing</b> damage.`,
      pt: `Isarelis nunca se anuncia — a lâmina já entrou antes de o alvo perceber que ela se moveu. Sempre que age antes do alvo escolhido, seus ataques causam <b>+${this.damageBonusRatio * 100}%</b> de dano bônus e convertem <b>${this.piercingRatio * 100}%</b> de seu dano em dano <b>Perfurante</b>.`,
    };
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
