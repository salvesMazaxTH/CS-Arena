import { grantStats } from "./emblemGrants.js";
import { formatChampionName } from "../../ui/formatters.js";

export const earthshaker = {
  key: "earthshaker",
  name: "Emblem of the Earthshaker",
  defenseBonus: 25,

  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> and are immune to <b>control effects</b>.`,
      pt: `Seus campeões ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> e são imunes a <b>efeitos de controle</b>.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);

    return true;
  },

  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (!statusEffect?.subtypes) return;
    if (statusEffect.subtypes.includes("systemic")) return;

    const isControl =
      statusEffect.subtypes.includes("hardCC") ||
      statusEffect.subtypes.includes("softCC");

    if (!isControl) return;

    return {
      cancel: true,
      message: {
        en: `<b>[Emblem — Earthshaker]</b> ${formatChampionName(target)} is immune to control effects!`,
        pt: `<b>[Emblema — Earthshaker]</b> ${formatChampionName(target)} é imune a efeitos de controle!`,
      },
    };
  },
};
