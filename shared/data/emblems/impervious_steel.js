import { formatChampionName } from "../../ui/formatters.js";

export const impervious_steel = {
  key: "impervious_steel",
  name: "Emblem of Impervious Steel",
  dmgReductionPercent: 15,
  piercingResistPercent: 50,

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 5,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>${this.dmgReductionPercent}%</b> <b>Damage Reduction</b> (except <b>Absolute Damage</b>) and <b>Piercing</b> damage against them loses <b>${this.piercingResistPercent}%</b> of its effectiveness.`,
      pt: `Seus campeões ganham <b>${this.dmgReductionPercent}%</b> de <b>Redução de Dano</b> (exceto <b>Dano Absoluto</b>) e o dano <b>Perfurante</b> contra eles perde <b>${this.piercingResistPercent}%</b> de sua eficácia.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    champion.applyDamageReduction({
      amount: this.dmgReductionPercent,
      type: "percent",
      duration: 9999,
      source: this.name,
      context,
    });

    return true;
  },

  onBeforeDmgTaking({ defender, owner, mode, piercingPercentage }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (mode !== "piercing") return;

    const resistedPiercing =
      Number(piercingPercentage || 0) * (1 - this.piercingResistPercent / 100);

    return {
      piercingPercentage: resistedPiercing,
      log: {
        en: `<b>[Emblem — Impervious Steel]</b> ${formatChampionName(defender)}'s steel resists the piercing strike, cutting its effectiveness by ${this.piercingResistPercent}%!`,
        pt: `<b>[Emblema — Impervious Steel]</b> o aço de ${formatChampionName(defender)} resiste ao golpe perfurante e corta ${this.piercingResistPercent}% da sua eficácia!`,
      },
    };
  },
};
