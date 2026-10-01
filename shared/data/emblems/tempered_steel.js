import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";
import { formatChampionName } from "../../ui/formatters.js";

// The 3-steel tier below Impervious Steel: flat Defense instead of Damage
// Reduction, and a lighter cut to Piercing.
export const temperedSteel = {
  key: "tempered_steel",
  name: "Emblem of Tempered Steel",
  defenseBonus: 10,
  piercingResistPercent: 25,

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> and <b>Piercing</b> damage against them loses <b>${this.piercingResistPercent}%</b> of its effectiveness.`,
      pt: `Seus campeões ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> e o dano <b>Perfurante</b> contra eles perde <b>${this.piercingResistPercent}%</b> de sua eficácia.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);

    return true;
  },

  onBeforeDmgTaking({ defender, owner, mode, piercingPercentage }) {
    if (!defender || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (mode !== "piercing") return;

    const resistedPiercing =
      Number(piercingPercentage || 0) * (1 - this.piercingResistPercent / 100);

    return {
      piercingPercentage: resistedPiercing,
      log: {
        en: `<b>[Emblem — Tempered Steel]</b> ${formatChampionName(defender)}'s steel blunts the piercing strike, cutting its effectiveness by <b>${this.piercingResistPercent}%</b>!`,
        pt: `<b>[Emblema — Tempered Steel]</b> o aço de ${formatChampionName(defender)} amortece o golpe perfurante e corta <b>${this.piercingResistPercent}%</b> da sua eficácia!`,
      },
    };
  },
};
