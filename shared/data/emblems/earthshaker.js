import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";
import { grantStats } from "./emblemGrants.js";
import { formatChampionName } from "../../ui/formatters.js";

export const earthshaker = {
  key: "earthshaker",
  name: "Emblem of the Earthshaker",
  defenseBonus: 20,
  immuneSubtype: "hardCC",

  requirements: {
    elementalAffinity: {
      element: "earth",
      count: 3,
    },
  },

  description() {
    // Named from the registry so the text follows whatever counts as hard CC.
    const immune = Object.values(StatusEffectsRegistry).filter(
      (status) =>
        status.subtypes?.includes(this.immuneSubtype) &&
        !status.subtypes.includes("systemic"),
    );
    const immuneEn = immune.map((s) => `<b>${s.name}</b>`).join(" and ");
    const immunePt = immune.map((s) => `<b>${s.namePt}</b>`).join(" e ");
    return {
      en: `Your champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> and are immune to ${immuneEn}.`,
      pt: `Seus campeões ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> e ficam imunes a ${immunePt}.`,
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

    if (!statusEffect.subtypes.includes(this.immuneSubtype)) return;

    return {
      cancel: true,
      message: {
        en: `<b>[Emblem — Earthshaker]</b> ${formatChampionName(target)} is immune to <b>${statusEffect.name}</b>!`,
        pt: `<b>[Emblema — Earthshaker]</b> ${formatChampionName(target)} é imune a <b>${statusEffect.namePt}</b>!`,
      },
    };
  },
};
