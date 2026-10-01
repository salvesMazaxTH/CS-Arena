// shared/data/emblems/permafrost.js

import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";
import { hasElement } from "../../engine/combat/elements.js";
import { formatChampionName } from "../../ui/formatters.js";
import { isEmblemBeneficiary } from "./emblemGrants.js";

export const permafrost = {
  key: "permafrost",
  name: "Emblem of the Permafrost",

  baseDamageReductionPercent: 7,
  iceDamageReductionPercent: 12,
  iceHitShieldPercent: 25,
  immuneStatusKey: "chilled",

  requirements: {
    elementalAffinity: {
      element: "ice",
      count: 3,
    },
  },

  description() {
    return {
      en: `The cold your team carries is the settled kind — old ice that has forgotten how to melt and does not feel a fresh chill land on it. Every allied champion is immune to <b>${StatusEffectsRegistry[this.immuneStatusKey].name}</b> and takes <b>${this.baseDamageReductionPercent}%</b> less damage (except <b>Absolute Damage</b>), rising to <b>${this.iceDamageReductionPercent}%</b> against Ice damage; when Ice damage does land, <b>${this.iceHitShieldPercent}%</b> of it freezes onto the champion as a <b>Shield</b>.`,
      pt: `O frio que sua equipe carrega é o frio assentado — gelo antigo que esqueceu como derreter e nem sente um novo calafrio pousar nele. Todo campeão aliado é imune a <b>${StatusEffectsRegistry[this.immuneStatusKey].namePt}</b> e sofre <b>${this.baseDamageReductionPercent}%</b> menos dano (exceto <b>Dano Absoluto</b>), subindo para <b>${this.iceDamageReductionPercent}%</b> contra dano de Gelo; quando o dano de Gelo de fato atinge, <b>${this.iceHitShieldPercent}%</b> dele congela sobre o campeão como um <b>Escudo</b>.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  // Ice champions already shrug off Chilled and Frozen natively; this extends
  // only the Chilled half to the rest of the team, never Frozen.
  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || !isEmblemBeneficiary(target, owner)) return;
    if (statusEffect?.key !== this.immuneStatusKey) return;

    return {
      cancel: true,
      message: {
        en: `<b>[Emblem — Permafrost]</b> ${formatChampionName(target)}'s cold is too old to feel the chill.`,
        pt: `<b>[Emblema — Permafrost]</b> o frio de ${formatChampionName(target)} é antigo demais para sentir o calafrio.`,
      },
    };
  },

  onBeforeDmgTaking({ defender, owner, element, damage }) {
    if (!defender || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (!(damage > 0)) return;

    const percent =
      hasElement(element, "ice")
        ? this.iceDamageReductionPercent
        : this.baseDamageReductionPercent;

    return { damage: damage * (1 - percent / 100) };
  },

  onAfterDmgTaking({ defender, owner, element, actualDmg, context }) {
    if (!defender?.alive || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (!hasElement(element, "ice") || !(actualDmg > 0)) return;

    const shield = Math.floor(actualDmg * (this.iceHitShieldPercent / 100));
    if (shield <= 0) return;

    defender.addShield(shield, 0, context, "regular", {
      sourceId: defender.id,
    });

    return {
      log: {
        en: `<b>[Emblem — Permafrost]</b> the Ice that struck ${formatChampionName(defender)} freezes into a <b>${shield}</b> HP Shield.`,
        pt: `<b>[Emblema — Permafrost]</b> o Gelo que atingiu ${formatChampionName(defender)} congela em um Escudo de <b>${shield}</b> de HP.`,
      },
    };
  },
};
