// shared/data/emblems/tank_bulwark.js

import { championHasClass } from "../championClasses.js";

export const tankBulwark = {
  key: "tank_bulwark",
  name: "Emblem of the Titan's Bulwark",
  defenseBonus: 20,
  maxHPBonusPercent: 5,

  requirements: {
    classKey: [{ key: "tank", count: 5 }],
  },

  description() {
    return {
      en: `Your Tank class champions gain +${this.defenseBonus} Defense and +${this.maxHPBonusPercent}% Max HP.`,
      pt: `Seus campeões da classe Tanque ganham +${this.defenseBonus} de Defesa e +${this.maxHPBonusPercent}% de HP Máximo.`,
    };
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!champion || !owner) return;
    if (champion.team !== owner.team) return;
    if (!championHasClass(champion, "tank")) return;

    // Mark that this champion has already received the emblem buff
    if (champion.runtime?._tankBulwarkApplied) return;

    if (!champion.runtime) champion.runtime = {};
    champion.runtime._tankBulwarkApplied = true;

    // Apply buff only to this specific champion
    if (champion.modifyStat) {
      champion.modifyStat({
        statName: "Defense",
        amount: this.defenseBonus,
        context,
        isPermanent: true,
      });
    }

    const hpBonus = Math.max(
      1,
      Math.round((champion.maxHP || 100) * (this.maxHPBonusPercent / 100)),
    );
    if (champion.modifyHP) {
      champion.modifyHP(hpBonus, {
        affectMax: true,
        isPermanent: true,
        context,
      });
    } else {
      champion.maxHP = (champion.maxHP || 0) + hpBonus;
      champion.HP = Math.min((champion.HP || 0) + hpBonus, champion.maxHP);
    }
  },
};
