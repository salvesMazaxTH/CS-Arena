// shared/data/emblems/verdant_root.js

import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";
import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";
import { formatChampionName } from "../../ui/formatters.js";

export const verdantRoot = {
  key: "verdant_root",
  name: "Emblem of the Verdant Root",
  defenseBonus: 10,
  immuneStatusKeys: ["poisoned", "rooted"],

  requirements: {
    elementalAffinity: {
      element: "plant",
      count: 3,
    },
  },

  description() {
    const immunitiesEn = this.immuneStatusKeys
      .map((key) => `<b>${StatusEffectsRegistry[key].name}</b>`)
      .join(" and ");
    const immunitiesPt = this.immuneStatusKeys
      .map((key) => `<b>${StatusEffectsRegistry[key].namePt}</b>`)
      .join(" e ");
    return {
      en: `Your champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> when entering combat and are immune to ${immunitiesEn}.`,
      pt: `Seus campeões ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> ao entrar em combate e são imunes a ${immunitiesPt}.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);

    return true;
  },

  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || !isEmblemBeneficiary(target, owner)) return;
    if (!this.immuneStatusKeys.includes(statusEffect?.key)) return;

    const status = StatusEffectsRegistry[statusEffect.key];
    return {
      cancel: true,
      message: {
        en: `<b>[Emblem — Verdant Root]</b> ${formatChampionName(target)}'s roots shrug off <b>${status.name}</b>.`,
        pt: `<b>[Emblema — Verdant Root]</b> as raízes de ${formatChampionName(target)} repelem o efeito <b>${status.namePt}</b>.`,
      },
    };
  },
};
