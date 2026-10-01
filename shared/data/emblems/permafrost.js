// shared/data/emblems/permafrost.js

import { StatusEffectsRegistry } from "../statusEffects/effectsRegistry.js";
import { hasElement } from "../../engine/combat/elements.js";

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
      en: `The cold your team carries is the settled kind — old ice that has forgotten how to melt and does not feel a fresh chill land on it. Every allied champion is immune to ${StatusEffectsRegistry[this.immuneStatusKey].name} and takes ${this.baseDamageReductionPercent}% less damage (except Absolute Damage), rising to ${this.iceDamageReductionPercent}% against Ice damage; when Ice damage does land, ${this.iceHitShieldPercent}% of it freezes onto the champion as a Shield.`,
      pt: `O frio que sua equipe carrega é o frio assentado — gelo antigo que esqueceu como derreter e nem sente um novo calafrio pousar nele. Todo campeão aliado é imune a Gelado e sofre ${this.baseDamageReductionPercent}% menos dano (exceto Dano Absoluto), subindo para ${this.iceDamageReductionPercent}% contra dano de Gelo; quando o dano de Gelo de fato atinge, ${this.iceHitShieldPercent}% dele congela sobre o campeão como um Escudo.`,
    };
  },

  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  // Ice champions already shrug off Chilled and Frozen natively; this extends
  // only the Chilled half to the rest of the team, never Frozen.
  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (statusEffect?.key !== this.immuneStatusKey) return;

    return {
      cancel: true,
      message: `<b>[Emblem — Permafrost]</b> ${target.name}'s cold is too old to feel the chill.`,
    };
  },

  onBeforeDmgTaking({ defender, owner, element, damage }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!(damage > 0)) return;

    const percent =
      hasElement(element, "ice")
        ? this.iceDamageReductionPercent
        : this.baseDamageReductionPercent;

    return { damage: damage * (1 - percent / 100) };
  },

  onAfterDmgTaking({ defender, owner, element, actualDmg, context }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!hasElement(element, "ice") || !(actualDmg > 0)) return;

    const shield = Math.floor(actualDmg * (this.iceHitShieldPercent / 100));
    if (shield <= 0) return;

    defender.addShield(shield, 0, context, "regular", {
      sourceId: defender.id,
    });

    return {
      log: `<b>[Emblem — Permafrost]</b> the Ice that struck ${defender.name} freezes into a ${shield} HP Shield.`,
    };
  },
};
