// shared/data/emblems/creeping_venom.js

import { hasElement } from "../../engine/combat/elements.js";
import { formatChampionName } from "../../ui/formatters.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

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
      en: `Your Poison attacks deal <b>${this.bonusDmg}</b> bonus damage to <b>Poisoned</b> enemies.`,
      pt: `Seus ataques de Veneno causam <b>${this.bonusDmg}</b> de dano bônus a inimigos <b>Envenenados</b>.`,
    };
  },

  onBeforeDmgDealing({ attacker, defender, element, owner }) {
    if (!attacker || !defender || !owner) return;
    if (!isEmblemBeneficiary(attacker, owner)) return;
    if (!hasElement(element, "poison")) return;
    if (!defender.hasStatusEffect("poisoned")) return;

    return {
      bonusDamage: this.bonusDmg,
      log: {
        en: `<b>[Emblem — Creeping Venom]</b> the venom already in ${formatChampionName(defender)} feeds the strike for <b>${this.bonusDmg}</b> bonus damage.`,
        pt: `<b>[Emblema — Creeping Venom]</b> o veneno que já corre em ${formatChampionName(defender)} alimenta o golpe com <b>${this.bonusDmg}</b> de dano bônus.`,
      },
    };
  },
};
