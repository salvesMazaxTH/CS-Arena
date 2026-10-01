// shared/data/emblems/assassins_ambush.js

import { championHasClass } from "../championClasses.js";
import { formatChampionName } from "../../ui/formatters.js";

export const assassinsAmbush = {
  key: "assassins_ambush",
  name: "Emblem of the Assassin's Ambush",
  extraPiercingPercent: 25,
  minimumPiercing: 25,

  requirements: {
    classKey: [{ key: "assassin", count: 5 }],
  },

  description() {
    return {
      en: `Your Assassin class champions' attacks always deal <b>Piercing Damage</b>, ignoring <b>${this.extraPiercingPercent}%</b> more <b>Defense</b> than the attack already ignores, and never less than <b>${this.minimumPiercing}%</b> of it.`,
      pt: `Os ataques dos seus campeões da classe Assassino sempre causam <b>Dano Perfurante</b>, ignorando <b>${this.extraPiercingPercent}%</b> a mais de <b>Defesa</b> do que o ataque já ignora, e nunca menos que <b>${this.minimumPiercing}%</b> dela.`,
    };
  },

  onBeforeDmgDealing({ attacker, defender, owner, mode }) {
    if (!attacker || !owner || attacker.team !== owner.team) return;
    if (!championHasClass(attacker, "assassin")) return;

    // Absolute damage already ignores Defense entirely — never downgrade it.
    if (mode === "absolute") return;

    return {
      mode: "piercing",
      piercingMultiplier: 1 + this.extraPiercingPercent / 100,
      piercingFloor: this.minimumPiercing,
      log: {
        en: `<b>[Emblem — Assassin's Ambush]</b> ${defender ? formatChampionName(defender) : "the target"} is caught in the ambush: the strike ignores ${this.extraPiercingPercent}% more of their Defense.`,
        pt: `<b>[Emblema — Assassin's Ambush]</b> ${defender ? formatChampionName(defender) : "o alvo"} cai na emboscada: o golpe ignora ${this.extraPiercingPercent}% a mais da sua Defesa.`,
      },
    };
  },
};
