// shared/data/emblems/assassins_ambush.js

import { championHasClass } from "../championClasses.js";

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
      en: `Your Assassin class champions' attacks always deal Piercing Damage, ignoring ${this.extraPiercingPercent}% more Defense than the attack already ignores, and never less than ${this.minimumPiercing}% of it.`,
      pt: `Os ataques dos seus campeões da classe Assassino sempre causam Dano Perfurante, ignorando ${this.extraPiercingPercent}% a mais de Defesa do que o ataque já ignora, e nunca menos que ${this.minimumPiercing}% dela.`,
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
      log: `<b>[Emblem — Assassin's Ambush]</b> ${defender?.name ?? "the target"} is caught in the ambush: the strike ignores ${this.extraPiercingPercent}% more of their Defense.`,
    };
  },
};
