import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";

export const thunderRoar = {
  key: "thunder_roar",
  name: "Emblem of the Thunder Roar",
  speedBonus: 10,

  requirements: {
    elementalAffinity: {
      element: "lightning",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>+${this.speedBonus}</b> <b>Speed</b>, and the thunder's energy makes their skills impossible to evade.`,
      pt: `Seus campeões ganham <b>+${this.speedBonus}</b> de <b>Velocidade</b>, e a energia do trovão torna suas habilidades impossíveis de esquivar.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;

    grantStats(champion, { Speed: this.speedBonus }, context);

    // Kept on the runtime, not stamped on the skills: a transformation swaps the
    // skill objects but carries the runtime, so the new form keeps it too.
    champion.runtime.ownSkillsCannotBeEvaded = true;

    return true;
  },
};
