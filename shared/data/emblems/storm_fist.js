// shared/data/emblems/storm_fist.js
//
// First mixed emblem: it asks for two different requirement kinds at once
// (a class and an elemental affinity), so both checks must pass to unlock it.
// Both halves of the roster are rewarded — the Speed grant is just tuned per
// half, since Lightning champions are already fast and Brawlers usually are not.

import { championHasClass } from "../championClasses.js";
import { grantStats } from "./emblemGrants.js";
import { championHasAffinity } from "../championTraits.js";

function carriesTheStorm(champion) {
  return (
    championHasClass(champion, "brawler") ||
    championHasAffinity(champion, "lightning")
  );
}

export const stormFist = {
  key: "storm_fist",
  name: "Emblem of the Storm Fist",
  bonusDmgPercent: 15,
  brawlerSpeedBonus: 12,
  lightningSpeedBonus: 5,

  requirements: {
    classKey: [{ key: "brawler", count: 3 }],
    elementalAffinity: {
      element: "lightning",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Brawler champions gain +${this.brawlerSpeedBonus} Speed and your Lightning champions gain +${this.lightningSpeedBonus} Speed when entering combat. Both deal ${this.bonusDmgPercent}% bonus damage to enemies slower than them.`,
      pt: `Seus campeões Lutadores ganham +${this.brawlerSpeedBonus} de Velocidade e seus campeões de Raio ganham +${this.lightningSpeedBonus} de Velocidade ao entrar em combate. Ambos causam ${this.bonusDmgPercent}% de dano adicional a inimigos mais lentos que eles.`,
    };
  },

  // A champion that is both takes the higher grant, not the sum.
  speedGrant(champion) {
    return Math.max(
      championHasClass(champion, "brawler") ? this.brawlerSpeedBonus : 0,
      championHasAffinity(champion, "lightning") ? this.lightningSpeedBonus : 0,
    );
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (champion.team !== owner.team) return;

    const speedBonus = this.speedGrant(champion);
    if (!speedBonus) return;

    grantStats(champion, { Speed: speedBonus }, context);
  },

  onBeforeDmgDealing({ attacker, defender, damage, owner }) {
    if (!attacker || !defender || !owner) return;

    if (attacker.team !== owner.team) return;

    // Either half of the emblem carries the storm.
    if (!carriesTheStorm(attacker)) return;

    // The strike only lands as a storm on those it can outpace.
    if (Number(attacker.Speed) <= Number(defender.Speed)) return;

    const bonusDamage = Number(damage) * (this.bonusDmgPercent / 100);
    const newDamage = Number(damage) + bonusDamage;

    return {
      damage: newDamage,
    };
  },
};
