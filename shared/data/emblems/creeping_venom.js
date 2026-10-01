import { hasElement } from "../../engine/combat/elements.js";

// shared/data/emblems/creeping_venom.js

export const creepingVenom = {
  key: "creeping_venom",
  name: "Emblem of the Creeping Venom",
  bonusDmg: 25,

  requirements: {
    elementalAffinity: {
      element: "poison",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your Poison attacks deal <b>${this.bonusDmg}</b> bonus damage to Poisoned enemies.`,
      pt: `Seus ataques de Veneno causam <b>${this.bonusDmg}</b> de dano bônus a inimigos <b>Envenenados</b>.`,
    };
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (attacker.team !== owner.team) return;
    if (!hasElement(element, "poison")) return;
    if (!defender.hasStatusEffect("poisoned")) return;

    return {
      bonusDamage: this.bonusDmg,
    };
  },
};
