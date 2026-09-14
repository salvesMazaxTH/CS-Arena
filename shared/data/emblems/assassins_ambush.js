// shared/data/emblems/assassins_ambush.js

import { championHasClass } from "../championClasses.js";

export const assassinsAmbush = {
  key: "assassins_ambush",
  name: "Emblem of the Assassin's Ambush",
  piercingMultiplier: 1.25,
  minimumPiercing: 25,

  requirements: {
    classKey: {
      key: "assassin",
      count: 5,
    },
  },

  description() {
    return `Your Assassin class champions' attacks always deal Piercing Damage, ignoring ${Math.round((this.piercingMultiplier - 1) * 100)}% more Defense than the attack already ignores, and never less than ${this.minimumPiercing}% of it.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, defender, owner, mode }) {
    if (!attacker || !owner || attacker.team !== owner.team) return;
    if (!championHasClass(attacker, "assassin")) return;

    // Absolute damage already ignores Defense entirely — never downgrade it.
    if (mode === "absolute") return;

    return {
      mode: "piercing",
      piercingMultiplier: this.piercingMultiplier,
      piercingFloor: this.minimumPiercing,
      log: `<b>[Emblem — Assassin's Ambush]</b> ${defender?.name ?? "the target"} is caught in the ambush: the strike ignores ${Math.round((this.piercingMultiplier - 1) * 100)}% more of their Defense.`,
    };
  },
};
