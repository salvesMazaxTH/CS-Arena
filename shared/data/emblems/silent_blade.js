// shared/data/emblems/silent_blade.js

import { championHasClass } from "../championClasses.js";

export const silentBlade = {
  key: "silent_blade",
  name: "Emblem of the Silent Blade",

  requirements: {
    classKey: {
      key: "assassin",
      count: 3,
    },
  },

  description() {
    return "Your Assassin class champions gain +15 Speed and +10% Critical Chance.";
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "assassin")) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._silentBladeApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._silentBladeApplied = true;

    // Apply buff only to this specific champion
    if (champion.modifyStat) {
      champion.modifyStat({
        statName: "Speed",
        amount: 15,
        context,
        isPermanent: true,
      });
      champion.modifyStat({
        statName: "Critical",
        amount: 10,
        context,
        isPermanent: true,
      });
    }
  },
};
